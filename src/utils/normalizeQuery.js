// Maps incoming category/subCategory variants to the canonical values stored in Snowflake.
function normalizeQuery(category, subCategory) {
  let mappedCat = (category || "").trim();
  let mappedSub = (subCategory || "").trim().replace(/-/g, " ");

  const lowerCat = mappedCat.toLowerCase();
  const lowerSub = mappedSub.toLowerCase();

  if (lowerCat === "speaking") {
    mappedCat = "Speaking & Writing";
    
    if (lowerSub === "re tell lecture" || lowerSub === "retell lecture" || lowerSub === "re-tell lecture") {
      mappedSub = "Re-tell Lecture";
    } else if (lowerSub === "answer short question" || lowerSub === "answer short questions") {
      mappedSub = "Answer Short Questions";
    } else if (lowerSub === "read aloud") {
      mappedSub = "Read Aloud";
    } else if (lowerSub === "repeat sentence") {
      mappedSub = "Repeat Sentence";
    } else if (lowerSub === "describe image") {
      mappedSub = "Describe Image";
    }
  } else if (lowerCat === "writing") {
    mappedCat = "Speaking & Writing";
    
    if (lowerSub === "essay" || lowerSub === "write essay") {
      mappedSub = "Write Essay";
    } else if (lowerSub === "summarize written text" || lowerSub === "summarize written text (core)") {
      mappedSub = "Summarize Written Text";
    }
  } else if (lowerCat === "reading") {
    mappedCat = "Reading";
    
    if (lowerSub === "multiple choice single answer" || lowerSub === "multiple choice, single answer" || lowerSub === "single answer") {
      mappedSub = "Multiple Choice Single Answer";
    } else if (lowerSub === "multiple choice multiple answer" || lowerSub === "multiple choice, multiple answer" || lowerSub === "multiple choice, multiple answers" || lowerSub === "multiple answers") {
      mappedSub = "Multiple Choice Multiple Answer";
    } else if (lowerSub === "reorder paragraph" || lowerSub === "reorder paragraphs" || lowerSub === "re-order paragraphs") {
      mappedSub = "Reorder Paragraph";
    } else if (lowerSub === "reading fill in the blanks" || lowerSub === "reading: fill in the blanks" || lowerSub === "fill in blanks" || lowerSub === "fill in the blanks (drag and drop)") {
      mappedSub = "Reading Fill in the Blanks";
    } else if (lowerSub === "fill in the blanks reading & writing" || lowerSub === "reading & writing: fill in the blanks" || lowerSub === "r/w fill in blanks" || lowerSub === "fill in the blanks (dropdown)") {
      mappedSub = "Fill in the Blanks Reading & Writing";
    }
  } else if (lowerCat === "listening") {
    mappedCat = "Listening";
    
    if (lowerSub === "summarize spoken text" || lowerSub === "summarize spoken text (core)") {
      mappedSub = "Summarize Spoken Text";
    } else if (lowerSub === "mcq single answer" || lowerSub === "multiple choice, single answer" || lowerSub === "single answer") {
      mappedSub = "MCQ Single Answer";
    } else if (lowerSub === "mcq multiple answer" || lowerSub === "multiple choice, multiple answers" || lowerSub === "multiple answers") {
      mappedSub = "MCQ Multiple Answer";
    } else if (lowerSub === "listening fill in the blanks" || lowerSub === "fill in the blanks (type in)" || lowerSub === "fill in blanks") {
      mappedSub = "Listening Fill in the Blanks";
    } else if (lowerSub === "highlight correct summary") {
      mappedSub = "Highlight Correct Summary";
    } else if (lowerSub === "select missing word") {
      mappedSub = "Select Missing Word";
    } else if (lowerSub === "highlight incorrect word") {
      mappedSub = "Highlight Incorrect Word";
    } else if (lowerSub === "write from dictation") {
      mappedSub = "Write from Dictation";
    } else if (lowerSub === "respond to a situation") {
      mappedSub = "Respond to a Situation";
    } else if (lowerSub === "summarize discussion") {
      mappedSub = "Summarize Discussion";
    } else if (lowerSub === "answer short question" || lowerSub === "answer short questions") {
      mappedCat = "Speaking & Writing";
      mappedSub = "Answer Short Questions";
    }
  }

  return { category: mappedCat, subCategory: mappedSub };
}

module.exports = { normalizeQuery };
