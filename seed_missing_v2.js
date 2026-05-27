const { query } = require("./src/db/snowflake");

async function seed() {
  console.log("Waiting for connection to establish...");
  await new Promise(resolve => setTimeout(resolve, 4000));
  try {
    // 1. Ensure configuration category for Personal Introduction is updated to 'Speaking'
    console.log("Ensuring Personal Introduction config has CATEGORY = 'Speaking'...");
    await query(`
      UPDATE PTE_EXAM_PREP_PLATFORM.PUBLIC.QUESTION_TYPE_CONFIG 
      SET CATEGORY = 'Speaking' 
      WHERE ID = 23
    `);
    console.log("Config category check/update completed.");

    // 2. Clean up existing questions for type 21, 22, and 23
    console.log("Cleaning up old database questions for type 21, 22, and 23...");
    await query(`
      DELETE FROM PTE_EXAM_PREP_PLATFORM.PUBLIC.QUESTION_DETAILS 
      WHERE QUESTION_TYPE_ID IN (21, 22, 23)
    `);
    console.log("Clean-up completed.");

    // 3. Insert the new questions with explicit IDs and model answers
    console.log("Inserting new questions...");
    
    // Insert Personal Introduction (ID 759)
    await query(`
      INSERT INTO PTE_EXAM_PREP_PLATFORM.PUBLIC.QUESTION_DETAILS 
      (ID, QUESTION_TYPE_ID, QUESTION_TEXT, INSTRUCTION, TITLE, CORRECT_ANSWER)
      VALUES 
      (759, 23, 'Please introduce yourself. Speak about your background, interests, and goals.', 'Read the prompt and introduce yourself. You have 25 seconds to prepare and 30 seconds to speak. This section is not scored but is sent to your selected institutions.', 'Personal Introduction - 1', 'My name is John Doe, and I am a software engineer with a passion for web development. In my free time, I enjoy reading and hiking. My goal is to study computer science abroad and advance my professional career.')
    `);

    // Insert Respond to a Situation (ID 760 - 764)
    await query(`
      INSERT INTO PTE_EXAM_PREP_PLATFORM.PUBLIC.QUESTION_DETAILS 
      (ID, QUESTION_TYPE_ID, QUESTION_TEXT, INSTRUCTION, TITLE, CORRECT_ANSWER)
      VALUES 
      (760, 21, 'You are at a library and need to find a book on database design, but the system is down. What do you do?', 'Listen to the situation and record your response on how you would handle it.', 'Respond to a Situation - 1', 'I would approach the librarian at the help desk, explain that the system is down, and ask if they can help me locate the database design section manually.'),
      (761, 21, 'A classmate forgot their project files at home and the presentation is in 10 minutes. How do you help them?', 'Listen to the situation and record your response.', 'Respond to a Situation - 2', 'I would suggest they check if their files are saved in the cloud or email, or offer to help them quickly retrieve them if they live nearby, or adjust the presentation order to buy them some time.'),
      (762, 21, 'You ordered a laptop online, but when it arrived, the screen was cracked. What do you do?', 'Listen to the situation and record your response.', 'Respond to a Situation - 3', 'I would immediately contact customer support, report the damaged item with photos as evidence, and request a replacement or a full refund.'),
      (763, 21, 'You are late for an important job interview because your train was delayed. What do you do?', 'Listen to the situation and record your response.', 'Respond to a Situation - 4', 'I would call the interviewer or the HR department as soon as possible, apologize for the unexpected train delay, provide an estimated arrival time, and ask if we can reschedule for later in the day.'),
      (764, 21, 'Your neighbor is playing loud music late at night, and you have an exam tomorrow morning. What do you do?', 'Listen to the situation and record your response.', 'Respond to a Situation - 5', 'I would go over to my neighbor''s house, politely explain that I have an exam tomorrow morning, and ask if they could turn down the volume for the night.')
    `);

    // Insert Summarize Discussion (ID 765 - 769)
    await query(`
      INSERT INTO PTE_EXAM_PREP_PLATFORM.PUBLIC.QUESTION_DETAILS 
      (ID, QUESTION_TYPE_ID, QUESTION_TEXT, INSTRUCTION, TITLE, CORRECT_ANSWER)
      VALUES 
      (765, 22, 'Group discussion on renewable energy vs nuclear energy benefits and costs.', 'Listen to the group discussion. Summarize the main points and arguments presented.', 'Summarize Discussion - 1', 'The group discussed renewable and nuclear energy. While renewable energy is clean and safe, its supply can be inconsistent. Nuclear energy provides stable power but poses waste disposal risks and high setup costs. In conclusion, the group agreed that a balanced energy mix is necessary for future sustainability.'),
      (766, 22, 'Group discussion on remote work trends, productivity, and employee wellness.', 'Listen to the discussion and summarize the key takeaways.', 'Summarize Discussion - 2', 'The speakers debated remote work''s impact. Remote work offers flexibility, saves commute time, and can improve employee wellness, but it may cause isolation. Some members noted that hybrid models balance productivity with social interaction. In conclusion, hybrid working seems to be the most viable solution.'),
      (767, 22, 'Group discussion on the impact of artificial intelligence on future employment opportunities.', 'Listen to the discussion and summarize the key arguments.', 'Summarize Discussion - 3', 'The discussion focused on artificial intelligence and jobs. Some participants feared job losses in administrative and manual roles, while others argued that AI will create new positions in technology and oversight. In conclusion, the group emphasized the need for retraining workers to adapt to AI-driven industries.'),
      (768, 22, 'Group discussion on the pros and cons of implementing a universal basic income.', 'Listen to the discussion and summarize the main viewpoints.', 'Summarize Discussion - 4', 'The group debated universal basic income. Supporters argued it reduces poverty and provides a safety net, whereas critics raised concerns about high funding costs and potential work disincentives. In conclusion, the group suggested that targeted pilot programs should be studied before full implementation.'),
      (769, 22, 'Group discussion on healthy diets, comparing veganism with traditional balanced diets.', 'Listen to the discussion and summarize the arguments.', 'Summarize Discussion - 5', 'The speakers compared vegan diets with traditional diets. The vegan diet is praised for ethical and environmental benefits, but requires careful supplement intake. Traditional diets offer easier access to all nutrients but can contain unhealthy fats. Ultimately, the group concluded that dietary balance is key to health.')
    `);

    console.log("Questions inserted successfully!");
    console.log("All seeding actions completed successfully!");
  } catch (err) {
    console.error("Seeding failed:", err.message);
  }
}

seed();
