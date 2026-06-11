const fs = require("fs");
const path = require("path");
const { query, connection } = require("./src/db/snowflake");

// Default PTE instructions for each question type (1 to 20)
const DEFAULT_INSTRUCTIONS = {
  1: "Look at the text below. In 35 seconds, you must read this text aloud as naturally and clearly as possible. You have 40 seconds to read.",
  2: "You will hear a sentence. Please repeat the sentence exactly as you hear it.",
  3: "Look at the image below. In 25 seconds, please speak into the microphone and describe in detail what the image is showing. You have 40 seconds to speak.",
  4: "You will hear a lecture. After listening to the lecture, in 10 seconds, please speak into the microphone and retell what you have just heard. You have 40 seconds to speak.",
  5: "You will hear a question. Please give a simple and short answer in one or a few words.",
  6: "Read the passage and summarize it in one sentence. Focus on key ideas.",
  7: "Write an essay on the given topic. Organize your ideas clearly with examples.",
  8: "Read the text and answer the multiple-choice question by selecting the correct response. Only one response is correct.",
  9: "Read the text and answer the question by selecting all the correct responses. More than one response may be correct.",
  10: "The text boxes in the left panel have been placed in a random order. Drag the text boxes and arrange them in the correct order.",
  11: "In the text below some words are missing. Drag words from the box below to fill the gaps.",
  12: "Below is a text with several gaps. Select the correct answer for each gap from the dropdown list.",
  13: "You will hear a short lecture. Write a summary for a fellow student who was not present at the lecture. You should write between 50-70 words.",
  14: "You will hear a recording. Answer the multiple-choice question by selecting the correct response. Only one response is correct.",
  15: "You will hear a recording. Answer the question by selecting all the correct responses. More than one response may be correct.",
  16: "You will hear a recording. Write the missing words in the gaps in the text.",
  17: "You will hear a recording. Choose the paragraph that best summarizes the recording.",
  18: "You will hear a recording. At the end of the recording the last word or group of words has been replaced by a beep. Select the correct option to complete the recording.",
  19: "You will hear a recording. Below is a transcription of the recording. Some words in the transcription differ from what was said. Click on the words that are different.",
  20: "You will hear a sentence. Write the sentence exactly as you hear it in the box below."
};

// Helper function to extract multiple choice options from question text
function parseOptions(text) {
  if (!text) return null;
  
  const matchA = text.indexOf(" A) ");
  const matchB = text.indexOf(" B) ");
  const matchC = text.indexOf(" C) ");
  const matchD = text.indexOf(" D) ");
  
  if (matchA !== -1 && matchB !== -1) {
    const options = [];
    const partA = text.slice(matchA + 1, matchB).trim();
    const partB = matchC !== -1 ? text.slice(matchB + 1, matchC).trim() : text.slice(matchB + 1).trim();
    options.push(partA);
    options.push(partB);
    
    if (matchC !== -1) {
      const partC = matchD !== -1 ? text.slice(matchC + 1, matchD).trim() : text.slice(matchC + 1).trim();
      options.push(partC);
    }
    if (matchD !== -1) {
      const partD = text.slice(matchD + 1).trim();
      options.push(partD);
    }
    return options;
  }
  return null;
}

async function insertAllQuestions() {
  console.log("Reading pte_questions_full_english.json...");
  const jsonPath = path.join(__dirname, "pte_questions_full_english.json");
  if (!fs.existsSync(jsonPath)) {
    console.error(`❌ Error: JSON file not found at ${jsonPath}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(jsonPath, "utf8");
  const data = JSON.parse(rawData);

  const modules = data.pte_practice_questions.modules;
  const questionsToInsert = [];

  // Parse and flatten questions from all modules/submodules
  modules.forEach(moduleItem => {
    moduleItem.submodules.forEach(submoduleItem => {
      const questionTypeId = submoduleItem.id;
      const submoduleName = submoduleItem.name;
      
      submoduleItem.questions.forEach(q => {
        const questionText = q.question;
        const correctAnswer = q.answer;
        const parsedOpts = parseOptions(questionText);
        
        const title = `${submoduleName} - ${q.id}`;
        const instruction = DEFAULT_INSTRUCTIONS[questionTypeId] || `Practice ${submoduleName} exercise.`;
        
        questionsToInsert.push({
          questionTypeId,
          questionText,
          audioUrl: null,
          imageUrl: null,
          options: parsedOpts ? JSON.stringify(parsedOpts) : null,
          instruction,
          title,
          correctAnswer
        });
      });
    });
  });

  console.log(`Parsed ${questionsToInsert.length} questions to insert.`);
  
  // Wait for Snowflake connection to be established
  console.log("Waiting for Snowflake connection...");
  await new Promise(resolve => setTimeout(resolve, 5000));

  const insertQuery = `
    INSERT INTO PTE_EXAM_PREP_PLATFORM.PUBLIC.QUESTION_DETAILS (
      QUESTION_TYPE_ID,
      QUESTION_TEXT,
      AUDIO_URL,
      IMAGE_URL,
      OPTIONS,
      INSTRUCTION,
      TITLE,
      CORRECT_ANSWER
    ) SELECT ?, ?, ?, ?, PARSE_JSON(?), ?, ?, ?
  `;

  let successCount = 0;
  let failCount = 0;
  const chunkSize = 15; // Insert in chunks of 15 promises in parallel to balance speed and safety

  for (let i = 0; i < questionsToInsert.length; i += chunkSize) {
    const chunk = questionsToInsert.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (q) => {
        try {
          await query(insertQuery, [
            q.questionTypeId,
            q.questionText,
            q.audioUrl,
            q.imageUrl,
            q.options,
            q.instruction,
            q.title,
            q.correctAnswer
          ]);
          successCount++;
          console.log(`✅ Success: ${q.title}`);
        } catch (err) {
          failCount++;
          console.error(`❌ Failed: ${q.title} - Error: ${err.message}`);
        }
      })
    );
    console.log(`Progress: ${i + chunk.length}/${questionsToInsert.length} completed.`);
  }

  console.log(`\nInsert session finished:`);
  console.log(`- Successfully inserted: ${successCount}`);
  console.log(`- Failed: ${failCount}`);

  // Destroy database connection to allow clean process exit
  try {
    connection.destroy(() => {
      console.log("Disconnected from Snowflake. Exiting...");
      process.exit(0);
    });
  } catch (err) {
    console.error("Error while closing connection:", err.message);
    process.exit(0);
  }
}

insertAllQuestions();