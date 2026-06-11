const { query } = require("./src/db/snowflake");

async function seed() {
  await new Promise(resolve => setTimeout(resolve, 3000));
  try {
    console.log("Checking if Personal Introduction config exists...");
    const checkConfig = await query("SELECT * FROM PTE_EXAM_PREP_PLATFORM.PUBLIC.QUESTION_TYPE_CONFIG WHERE ID = 23");
    if (checkConfig.length === 0) {
      console.log("Inserting Personal Introduction config...");
      await query(`
        INSERT INTO PTE_EXAM_PREP_PLATFORM.PUBLIC.QUESTION_TYPE_CONFIG 
        (ID, CATEGORY, TYPE, AUDIO_WAITING_TIME, RECORDING_WAITING_TIME, RECORDING_TIME, HAS_AUDIO, NEXT_BUTTON_BEHAVIOR)
        VALUES (23, 'Speaking & Writing', 'Personal Introduction', 0, 25, 30, false, 'enable')
      `);
      console.log("Personal Introduction config inserted!");
    }

    console.log("Checking if Personal Introduction questions exist...");
    const checkQuestions = await query("SELECT * FROM PTE_EXAM_PREP_PLATFORM.PUBLIC.QUESTION_DETAILS WHERE QUESTION_TYPE_ID = 23");
    if (checkQuestions.length === 0) {
      console.log("Inserting mock Personal Introduction question...");
      await query(`
        INSERT INTO PTE_EXAM_PREP_PLATFORM.PUBLIC.QUESTION_DETAILS 
        (QUESTION_TYPE_ID, QUESTION_TEXT, INSTRUCTION, TITLE, CORRECT_ANSWER)
        VALUES (23, 'Please introduce yourself. Speak about your background, interests, and goals.', 'Read the prompt and introduce yourself. You have 25 seconds to prepare and 30 seconds to speak. This section is not scored but is sent to your selected institutions.', 'Personal Introduction - 1', '')
      `);
    }

    console.log("Checking if Respond to a Situation questions exist...");
    const checkRespond = await query("SELECT * FROM PTE_EXAM_PREP_PLATFORM.PUBLIC.QUESTION_DETAILS WHERE QUESTION_TYPE_ID = 21");
    if (checkRespond.length === 0) {
      console.log("Inserting mock Respond to a Situation questions...");
      await query(`
        INSERT INTO PTE_EXAM_PREP_PLATFORM.PUBLIC.QUESTION_DETAILS 
        (QUESTION_TYPE_ID, QUESTION_TEXT, INSTRUCTION, TITLE, CORRECT_ANSWER)
        VALUES 
        (21, 'You are at a library and need to find a book on database design, but the system is down. What do you do?', 'Listen to the situation and record your response on how you would handle it.', 'Respond to a Situation - 1', ''),
        (21, 'A classmate forgot their project files at home and the presentation is in 10 minutes. How do you help them?', 'Listen to the situation and record your response.', 'Respond to a Situation - 2', '')
      `);
    }

    console.log("Checking if Summarize Discussion questions exist...");
    const checkDiscuss = await query("SELECT * FROM PTE_EXAM_PREP_PLATFORM.PUBLIC.QUESTION_DETAILS WHERE QUESTION_TYPE_ID = 22");
    if (checkDiscuss.length === 0) {
      console.log("Inserting mock Summarize Discussion questions...");
      await query(`
        INSERT INTO PTE_EXAM_PREP_PLATFORM.PUBLIC.QUESTION_DETAILS 
        (QUESTION_TYPE_ID, QUESTION_TEXT, INSTRUCTION, TITLE, CORRECT_ANSWER)
        VALUES 
        (22, 'Group discussion on renewable energy vs nuclear energy benefits and costs.', 'Listen to the group discussion. Summarize the main points and arguments presented.', 'Summarize Discussion - 1', ''),
        (22, 'Group discussion on remote work trends, productivity, and employee wellness.', 'Listen to the discussion and summarize the key takeaways.', 'Summarize Discussion - 2', '')
      `);
    }

    console.log("Seeding missing completed successfully!");
  } catch (err) {
    console.error("Seeding missing failed:", err);
  }
}

seed();
