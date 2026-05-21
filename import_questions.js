const fs = require("fs");
const path = require("path");
const connection = require("./db/snowflake");

// Load the JSON data
const jsonPath = path.join(__dirname, "questions.json");
if (!fs.existsSync(jsonPath)) {
  console.error("Please create a questions.json file in this directory and paste the JSON data there.");
  process.exit(1);
}

const rawData = fs.readFileSync(jsonPath, "utf-8");
const questions = JSON.parse(rawData);

console.log(`Loaded ${questions.length} questions from questions.json.`);

// Function to map exercise types to default parameters
function getDefaults(exercise, category, uid) {
  const normExercise = (exercise || "").toLowerCase();
  const normCategory = (category || "").toLowerCase();
  
  // 1. SPEAKING CATEGORY DEFAULTS
  if (normCategory === "speaking" || normExercise.includes("aloud") || normExercise.includes("repeat") || normExercise.includes("describe") || normExercise.includes("lecture") || normExercise.includes("short")) {
    if (normExercise.includes("aloud")) {
      return {
        audioWaitingTime: "00:00:00",
        recordingWaitingTime: "00:00:35",
        recordingTime: "00:00:40",
        contentType: "text",
        instruction: "Look at the text below. In 35 seconds, you must read this text aloud as naturally and clearly as possible. You have 40 seconds to read.",
        title: `Read Aloud - ${uid}`,
        audioUrl: null
      };
    } else if (normExercise.includes("repeat")) {
      return {
        audioWaitingTime: "00:00:03",
        recordingWaitingTime: "00:00:01",
        recordingTime: "00:00:15",
        contentType: "audio",
        instruction: "You will hear a sentence. Please repeat the sentence exactly as you hear it.",
        title: `Repeat Sentence - ${uid}`,
        audioUrl: null 
      };
    } else if (normExercise.includes("image")) {
      return {
        audioWaitingTime: "00:00:00",
        recordingWaitingTime: "00:00:25",
        recordingTime: "00:00:40",
        contentType: "image",
        instruction: "Look at the image below. In 25 seconds, please speak into the microphone and describe in detail what the image is showing. You have 40 seconds to speak.",
        title: `Describe Image - ${uid}`,
        audioUrl: null
      };
    } else if (normExercise.includes("lecture")) {
      return {
        audioWaitingTime: "00:00:03",
        recordingWaitingTime: "00:00:10",
        recordingTime: "00:00:40",
        contentType: "audio",
        instruction: "You will hear a lecture. After listening to the lecture, in 10 seconds, please speak into the microphone and retell what you have just heard. You have 40 seconds to speak.",
        title: `Retell Lecture - ${uid}`,
        audioUrl: null
      };
    } else if (normExercise.includes("short")) {
      return {
        audioWaitingTime: "00:00:03",
        recordingWaitingTime: "00:00:01",
        recordingTime: "00:00:10",
        contentType: "audio",
        instruction: "You will hear a question. Please give a simple and short answer in one or a few words.",
        title: `Answer Short Question - ${uid}`,
        audioUrl: null
      };
    }
  }

  // 2. WRITING CATEGORY DEFAULTS
  if (normCategory === "writing" || normExercise.includes("essay") || normExercise.includes("summarize written")) {
    if (normExercise.includes("summarize") || normExercise.includes("summary")) {
      return {
        audioWaitingTime: "00:00:00",
        recordingWaitingTime: "00:00:00",
        recordingTime: "00:00:00",
        contentType: "text",
        instruction: "Read the passage and summarize it in one sentence. Focus on key ideas.",
        title: `Summarize Written Text - ${uid}`,
        audioUrl: null
      };
    } else {
      return {
        audioWaitingTime: "00:00:00",
        recordingWaitingTime: "00:00:00",
        recordingTime: "00:00:00",
        contentType: "text",
        instruction: "Write an essay on the given topic. Organize your ideas clearly with examples.",
        title: `Write Essay - ${uid}`,
        audioUrl: null
      };
    }
  }

  // 3. READING & LISTENING DEFAULTS (General Fallbacks)
  return {
    audioWaitingTime: "00:00:00",
    recordingWaitingTime: "00:00:00",
    recordingTime: "00:00:00",
    contentType: "text",
    instruction: `Practice ${exercise || "general"} exercise.`,
    title: `${exercise || "Practice"} - ${uid}`,
    audioUrl: null
  };
}

async function insertQuestion(q, questionId) {
  // Try to find the content/prompt of the question across common keys
  const questionText = q.transcript || q.prompt || q.text || q.passage || q.question || q.question_text || "";
  
  // Format options (useful for multiple choice in Reading/Listening)
  let parsedOptions = null;
  if (q.options) {
    parsedOptions = typeof q.options === "string" ? q.options : JSON.stringify(q.options);
  }

  const category = q.section || q.category || "Speaking";
  let subCategory = q.exercise || q.sub_category || "Read Aloud";

  // Map "Write Essay" to "Essay" for Writing category
  if (category && category.toLowerCase() === "writing" && subCategory && subCategory.toLowerCase() === "write essay") {
    subCategory = "Essay";
  }

  const defaults = getDefaults(subCategory, category, q.uid || q.id || "Q");
  
  if (!questionId) {
    throw new Error("Question must have a numeric questionId assigned");
  }

  const query = `
    INSERT INTO PTE_EXAM_PREP_PLATFORM.PUBLIC.QUESTION_DETAILS (
      QUESTIONID, CATEGORY, SUB_CATEGORY, AUDIO_WAITING_TIME, RECORDING_WAITING_TIME,
      RECORDING_TIME, CONTENT_TYPE, QUESTION_TEXT, AUDIO_URL,
      IMAGE_URL, OPTIONS, INSTRUCTION, TITLE
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const binds = [
    questionId,
    category,
    subCategory,
    defaults.audioWaitingTime,
    defaults.recordingWaitingTime,
    defaults.recordingTime,
    q.content_type || defaults.contentType,
    questionText,
    q.audio_url || defaults.audioUrl,
    q.image_url || null,
    parsedOptions,
    q.instruction || defaults.instruction,
    q.title || defaults.title
  ];

  return new Promise((resolve, reject) => {
    connection.execute({
      sqlText: query,
      binds: binds,
      complete: function (err, stmt, rows) {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      }
    });
  });
}

async function importAll() {
  console.log("Connecting and checking existing questions in the database...");
  await new Promise(r => setTimeout(r, 3000)); 

  let existingRows = [];
  try {
    existingRows = await new Promise((resolve, reject) => {
      connection.execute({
        sqlText: "SELECT QUESTIONID, TITLE FROM PTE_EXAM_PREP_PLATFORM.PUBLIC.QUESTION_DETAILS",
        complete: function (err, stmt, rows) {
          if (err) {
            reject(err);
          } else {
            resolve(rows || []);
          }
        }
      });
    });
  } catch (err) {
    console.error("Failed to fetch existing questions:", err.message);
    process.exit(1);
  }

  const existingUids = new Set();
  let maxId = 0;
  
  for (const row of existingRows) {
    if (row.QUESTIONID > maxId) {
      maxId = row.QUESTIONID;
    }
    if (row.TITLE) {
      const match = row.TITLE.match(/ - ([A-Z0-9]+)$/);
      if (match) {
        existingUids.add(match[1]);
      }
    }
  }

  let nextId = maxId + 1;
  console.log(`Found ${existingRows.length} existing rows in table. Max ID: ${maxId}. Parsed ${existingUids.size} unique UIDs.`);

  // Filter the questions that are not already imported
  const toImport = questions.filter(q => {
    const uid = q.uid || q.id;
    return uid && !existingUids.has(uid);
  });

  const skipCount = questions.length - toImport.length;
  console.log(`Of the ${questions.length} total questions:`);
  console.log(`- ${skipCount} are already in the database (skipped).`);
  console.log(`- ${toImport.length} are new and will be imported.`);
  console.log(`Starting import of new questions from next ID: ${nextId}.`);

  let count = 0;
  const chunkSize = 20; // 20 concurrent queries at a time

  for (let i = 0; i < toImport.length; i += chunkSize) {
    const chunk = toImport.slice(i, i + chunkSize);
    await Promise.all(chunk.map(async (q, index) => {
      const currentId = nextId + i + index;
      const uid = q.uid || q.id;
      try {
        await insertQuestion(q, currentId);
        count++;
        console.log(`[${skipCount + i + index + 1}/${questions.length}] Imported ${uid} successfully with ID ${currentId}.`);
      } catch (err) {
        console.error(`Failed to import ${uid} (ID ${currentId}):`, err.message);
      }
    }));
  }

  console.log(`\nImport complete! Successfully imported ${count} new questions, skipped ${skipCount} already existing, out of ${questions.length} total.`);
  process.exit(0);
}

importAll();
