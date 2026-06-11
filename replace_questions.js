const fs = require("fs");
const path = require("path");
const connection = require("./db/snowflake");

const jsonPath = path.join(__dirname, "../Exam-Prep-Platform/questions.txt");
const rawData = fs.readFileSync(jsonPath, "utf-8");

let questions = [];
let currentCategory = "";
let currentSubCategory = "";

let i = 0;
while (i < rawData.length) {
  const startBracket = rawData.indexOf('[', i);
  if (startBracket === -1) break;

  const textBefore = rawData.substring(i, startBracket);
  const lines = textBefore.split('\n');
  for (let line of lines) {
    line = line.trim();
    if (line.endsWith("CATEGORY")) {
      currentCategory = line.replace(" CATEGORY", "").trim();
      currentCategory = currentCategory.charAt(0) + currentCategory.slice(1).toLowerCase();
    } else if (/^\d+\.\s+(.*)$/.test(line)) {
      currentSubCategory = line.match(/^\d+\.\s+(.*)$/)[1].trim();
    }
  }

  let startIndex = startBracket;
  let bracketCount = 0;
  let endIndex = -1;
  for (let j = startIndex; j < rawData.length; j++) {
    if (rawData[j] === '[') bracketCount++;
    else if (rawData[j] === ']') {
      bracketCount--;
      if (bracketCount === 0) {
        endIndex = j;
        break;
      }
    }
  }

  if (endIndex !== -1) {
    const jsonStr = rawData.substring(startIndex, endIndex + 1);
    try {
      const parsed = JSON.parse(jsonStr);
      for (let q of parsed) {
        q.category = currentCategory;
        q.sub_category = currentSubCategory;
        questions.push(q);
      }
    } catch (e) {
      console.error("Error parsing block at index", startIndex);
    }
    i = endIndex + 1;
  } else {
    break;
  }
}

console.log(`Parsed ${questions.length} questions from questions.txt`);

function getDefaults(exercise, category, uid) {
  const normExercise = (exercise || "").toLowerCase();
  const normCategory = (category || "").toLowerCase();
  
  if (normCategory === "speaking" || normExercise.includes("aloud") || normExercise.includes("repeat") || normExercise.includes("describe") || normExercise.includes("lecture") || normExercise.includes("short")) {
    if (normExercise.includes("aloud")) {
      return { instruction: "Look at the text below. In 35 seconds, you must read this text aloud as naturally and clearly as possible. You have 40 seconds to read.", title: `Read Aloud - ${uid}` };
    } else if (normExercise.includes("repeat")) {
      return { instruction: "You will hear a sentence. Please repeat the sentence exactly as you hear it.", title: `Repeat Sentence - ${uid}` };
    } else if (normExercise.includes("image")) {
      return { instruction: "Look at the image below. In 25 seconds, please speak into the microphone and describe in detail what the image is showing. You have 40 seconds to speak.", title: `Describe Image - ${uid}` };
    } else if (normExercise.includes("lecture")) {
      return { instruction: "You will hear a lecture. After listening to the lecture, in 10 seconds, please speak into the microphone and retell what you have just heard. You have 40 seconds to speak.", title: `Retell Lecture - ${uid}` };
    } else if (normExercise.includes("short")) {
      return { instruction: "You will hear a question. Please give a simple and short answer in one or a few words.", title: `Answer Short Question - ${uid}` };
    }
  }

  if (normCategory === "writing" || normExercise.includes("essay") || normExercise.includes("summarize written")) {
    if (normExercise.includes("summarize") || normExercise.includes("summary")) {
      return { instruction: "Read the passage and summarize it in one sentence. Focus on key ideas.", title: `Summarize Written Text - ${uid}` };
    } else {
      return { instruction: "Write an essay on the given topic. Organize your ideas clearly with examples.", title: `Write Essay - ${uid}` };
    }
  }

  return { instruction: `Practice ${exercise || "general"} exercise.`, title: `${exercise || "Practice"} - ${uid}` };
}

async function insertQuestion(q, questionId) {
  const questionText = q.question || q.transcript || q.prompt || q.text || q.passage || q.question_text || "";
  let parsedOptions = null;
  const rawOptions = q.question_mcq || q.options;
  if (rawOptions) {
    if (typeof rawOptions === "string") {
      try {
        JSON.parse(rawOptions);
        parsedOptions = rawOptions;
      } catch(e) {
        parsedOptions = JSON.stringify(rawOptions);
      }
    } else {
      parsedOptions = JSON.stringify(rawOptions);
    }
  }

  const category = q.category || "Speaking";
  let subCategory = q.sub_category || "Read Aloud";
  const defaults = getDefaults(subCategory, category, q.uid || q.id || questionId.toString());

  const query = `
    INSERT INTO PTE_EXAM_PREP_PLATFORM.PUBLIC.QUESTION_DETAILS (
      ID, QUESTION_TYPE_ID, QUESTION_TEXT, AUDIO_URL,
      IMAGE_URL, OPTIONS, INSTRUCTION, TITLE, CORRECT_ANSWER
    ) SELECT ?, ?, ?, ?, ?, PARSE_JSON(?), ?, ?, ?
  `;

  // We map QUESTION_TYPE_ID to subcategory_id from JSON (or fallback to 1)
  const questionTypeId = q.subcategory_id || 1;

  const binds = [
    questionId,
    questionTypeId,
    questionText,
    q.media_link || q.audio_url || null,
    q.image_link || q.image_url || null,
    parsedOptions || 'null',
    defaults.instruction,
    q.q_title ? `${subCategory} - ${q.q_title}` : defaults.title,
    q.answer || null
  ];

  return new Promise((resolve, reject) => {
    connection.execute({
      sqlText: query,
      binds: binds,
      complete: function (err, stmt, rows) {
        if (err) reject(err);
        else resolve(rows);
      }
    });
  });
}

async function run() {
  console.log("Connecting to Snowflake and deleting existing questions...");
  await new Promise(r => setTimeout(r, 2000));

  try {
    await new Promise((resolve, reject) => {
      connection.execute({
        sqlText: "DELETE FROM PTE_EXAM_PREP_PLATFORM.PUBLIC.QUESTION_DETAILS",
        complete: function(err, stmt, rows) {
          if (err) reject(err);
          else resolve(rows);
        }
      });
    });
    console.log("Successfully deleted existing questions.");
  } catch (err) {
    console.error("Failed to delete existing questions:", err.message);
    process.exit(1);
  }

  let count = 0;
  // Doing it sequentially so we don't overwhelm Snowflake
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const currentId = q.id || (i + 1);
    try {
      await insertQuestion(q, currentId);
      count++;
      if (count % 20 === 0) {
        console.log(`Inserted ${count}/${questions.length}`);
      }
    } catch (err) {
      console.error(`Failed to import question ID ${currentId}:`, err.message);
    }
  }

  console.log(`\nImport complete! Successfully replaced table with ${count} questions.`);
  process.exit(0);
}

run();
