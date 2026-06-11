const fs = require("fs");
const path = require("path");
const { connection, query } = require("../src/db/snowflake");

const jsonPath = path.join(__dirname, "..", "data", "questions.json");
if (!fs.existsSync(jsonPath)) {
  console.error("Missing data/questions.json. Place the JSON data there before running this script.");
  process.exit(1);
}

const rawData = fs.readFileSync(jsonPath, "utf-8");
const questions = JSON.parse(rawData);

console.log(`Loaded ${questions.length} questions from data/questions.json.`);

function getDefaults(exercise, category, uid) {
  const normExercise = (exercise || "").toLowerCase();
  const normCategory = (category || "").toLowerCase();

  if (
    normCategory === "speaking" ||
    normExercise.includes("aloud") ||
    normExercise.includes("repeat") ||
    normExercise.includes("describe") ||
    normExercise.includes("lecture") ||
    normExercise.includes("short")
  ) {
    if (normExercise.includes("aloud")) {
      return {
        audioWaitingTime: "00:00:00",
        recordingWaitingTime: "00:00:35",
        recordingTime: "00:00:40",
        contentType: "text",
        instruction:
          "Look at the text below. In 35 seconds, you must read this text aloud as naturally and clearly as possible. You have 40 seconds to read.",
        title: `Read Aloud - ${uid}`,
        audioUrl: null,
      };
    } else if (normExercise.includes("repeat")) {
      return {
        audioWaitingTime: "00:00:03",
        recordingWaitingTime: "00:00:01",
        recordingTime: "00:00:15",
        contentType: "audio",
        instruction: "You will hear a sentence. Please repeat the sentence exactly as you hear it.",
        title: `Repeat Sentence - ${uid}`,
        audioUrl: null,
      };
    } else if (normExercise.includes("image")) {
      return {
        audioWaitingTime: "00:00:00",
        recordingWaitingTime: "00:00:25",
        recordingTime: "00:00:40",
        contentType: "image",
        instruction:
          "Look at the image below. In 25 seconds, please speak into the microphone and describe in detail what the image is showing. You have 40 seconds to speak.",
        title: `Describe Image - ${uid}`,
        audioUrl: null,
      };
    } else if (normExercise.includes("lecture")) {
      return {
        audioWaitingTime: "00:00:03",
        recordingWaitingTime: "00:00:10",
        recordingTime: "00:00:40",
        contentType: "audio",
        instruction:
          "You will hear a lecture. After listening to the lecture, in 10 seconds, please speak into the microphone and retell what you have just heard. You have 40 seconds to speak.",
        title: `Retell Lecture - ${uid}`,
        audioUrl: null,
      };
    } else if (normExercise.includes("short")) {
      return {
        audioWaitingTime: "00:00:03",
        recordingWaitingTime: "00:00:01",
        recordingTime: "00:00:10",
        contentType: "audio",
        instruction: "You will hear a question. Please give a simple and short answer in one or a few words.",
        title: `Answer Short Question - ${uid}`,
        audioUrl: null,
      };
    }
  }

  if (normCategory === "writing" || normExercise.includes("essay") || normExercise.includes("summarize written")) {
    if (normExercise.includes("summarize") || normExercise.includes("summary")) {
      return {
        audioWaitingTime: "00:00:00",
        recordingWaitingTime: "00:00:00",
        recordingTime: "00:00:00",
        contentType: "text",
        instruction: "Read the passage and summarize it in one sentence. Focus on key ideas.",
        title: `Summarize Written Text - ${uid}`,
        audioUrl: null,
      };
    }
    return {
      audioWaitingTime: "00:00:00",
      recordingWaitingTime: "00:00:00",
      recordingTime: "00:00:00",
      contentType: "text",
      instruction: "Write an essay on the given topic. Organize your ideas clearly with examples.",
      title: `Write Essay - ${uid}`,
      audioUrl: null,
    };
  }

  return {
    audioWaitingTime: "00:00:00",
    recordingWaitingTime: "00:00:00",
    recordingTime: "00:00:00",
    contentType: "text",
    instruction: `Practice ${exercise || "general"} exercise.`,
    title: `${exercise || "Practice"} - ${uid}`,
    audioUrl: null,
  };
}

function normalizeCategoryAndSub(rawCategory, rawSub) {
  let category = (rawCategory || "Speaking").trim();
  let subCategory = (rawSub || "Read Aloud").trim();
  const lowerCat = category.toLowerCase();
  const lowerSub = subCategory.toLowerCase();

  if (lowerCat === "speaking") {
    if (lowerSub === "re-tell lecture") {
      subCategory = "Retell Lecture";
    }
  } else if (lowerCat === "writing") {
    if (lowerSub === "write essay" || lowerSub === "essay" || lowerSub === "write-essay") {
      subCategory = "Write Essay";
    } else if (lowerSub === "summarize written text" || lowerSub === "summarize written text (core)") {
      subCategory = "Summarize Written Text";
    }
  } else if (lowerCat === "reading") {
    if (
      lowerSub === "r/w fill in blanks" ||
      lowerSub === "fill in the blanks (dropdown)" ||
      lowerSub === "reading & writing: fill in the blanks"
    ) {
      subCategory = "Fill in the Blanks (Dropdown)";
    } else if (
      lowerSub === "fill in blanks" ||
      lowerSub === "fill in the blanks (drag and drop)" ||
      lowerSub === "reading: fill in the blanks"
    ) {
      subCategory = "Fill in the Blanks (Drag and Drop)";
    } else if (lowerSub === "re-order paragraphs" || lowerSub === "reorder paragraph" || lowerSub === "reorder paragraphs") {
      subCategory = "Reorder Paragraph";
    } else if (lowerSub === "multiple answers" || lowerSub === "multiple choice, multiple answers") {
      subCategory = "Multiple Choice, Multiple Answers";
    } else if (lowerSub === "single answer" || lowerSub === "multiple choice, single answer") {
      subCategory = "Multiple Choice, Single Answer";
    }
  } else if (lowerCat === "listening") {
    if (lowerSub === "answer short question") {
      // Answer Short Question is stored under Speaking
      category = "Speaking";
    } else if (lowerSub === "summarize spoken text" || lowerSub === "summarize spoken text (core)") {
      subCategory = "Summarize Spoken Text";
    } else if (lowerSub === "multiple answers" || lowerSub === "multiple choice, multiple answers") {
      subCategory = "Multiple Choice, Multiple Answers";
    } else if (lowerSub === "fill in blanks" || lowerSub === "fill in the blanks (type in)") {
      subCategory = "Fill in the Blanks (Type In)";
    } else if (lowerSub === "single answer" || lowerSub === "multiple choice, single answer") {
      subCategory = "Multiple Choice, Single Answer";
    } else if (lowerSub === "write from dictation") {
      subCategory = "Write from Dictation";
    }
  }

  return { category, subCategory };
}

async function insertQuestion(q, questionId) {
  if (!questionId) {
    throw new Error("Question must have a numeric questionId assigned");
  }

  const questionText =
    q.transcript || q.prompt || q.text || q.passage || q.question || q.question_text || "";

  let parsedOptions = null;
  if (q.options) {
    parsedOptions = typeof q.options === "string" ? q.options : JSON.stringify(q.options);
  }

  const { category, subCategory } = normalizeCategoryAndSub(
    q.section || q.category,
    q.exercise || q.sub_category,
  );

  const defaults = getDefaults(subCategory, category, q.uid || q.id || "Q");

  const sql = `
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
    q.title || defaults.title,
  ];

  return query(sql, binds);
}

async function importAll() {
  console.log("Connecting and checking existing questions in the database...");
  await new Promise((r) => setTimeout(r, 3000));

  let existingRows = [];
  try {
    existingRows = await query(
      "SELECT QUESTIONID, TITLE FROM PTE_EXAM_PREP_PLATFORM.PUBLIC.QUESTION_DETAILS",
    );
  } catch (err) {
    console.error("Failed to fetch existing questions:", err.message);
    process.exit(1);
  }

  const existingUids = new Set();
  let maxId = 0;
  for (const row of existingRows) {
    if (row.QUESTIONID > maxId) maxId = row.QUESTIONID;
    if (row.TITLE) {
      const match = row.TITLE.match(/ - ([A-Z0-9]+)$/);
      if (match) existingUids.add(match[1]);
    }
  }

  let nextId = maxId + 1;
  console.log(
    `Found ${existingRows.length} existing rows in table. Max ID: ${maxId}. Parsed ${existingUids.size} unique UIDs.`,
  );

  const toImport = questions.filter((q) => {
    const uid = q.uid || q.id;
    return uid && !existingUids.has(uid);
  });

  const skipCount = questions.length - toImport.length;
  console.log(`Of the ${questions.length} total questions:`);
  console.log(`- ${skipCount} are already in the database (skipped).`);
  console.log(`- ${toImport.length} are new and will be imported.`);
  console.log(`Starting import of new questions from next ID: ${nextId}.`);

  let count = 0;
  const chunkSize = 20;

  for (let i = 0; i < toImport.length; i += chunkSize) {
    const chunk = toImport.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (q, index) => {
        const currentId = nextId + i + index;
        const uid = q.uid || q.id;
        try {
          await insertQuestion(q, currentId);
          count++;
          console.log(
            `[${skipCount + i + index + 1}/${questions.length}] Imported ${uid} successfully with ID ${currentId}.`,
          );
        } catch (err) {
          console.error(`Failed to import ${uid} (ID ${currentId}):`, err.message);
        }
      }),
    );
  }

  console.log(
    `\nImport complete! Successfully imported ${count} new questions, skipped ${skipCount} already existing, out of ${questions.length} total.`,
  );

  // Make sure the connection does not keep the process alive after we are done.
  try {
    connection.destroy(() => process.exit(0));
  } catch {
    process.exit(0);
  }
}

importAll();
