const jwt = require("jsonwebtoken");

const jwtSecret = "96fcb371ea2574c45b08130fad15c9738a5b994ece381d6bcc57f79ec96eb41691c5ea751d1329c488d4f2c8b79b2a1dbbe782635427eaedfcc9d2adc813d95a";

const token = jwt.sign({ id: "1", email: "piya@mailinator.com" }, jwtSecret, { expiresIn: "1h" });

async function testFlow() {
  try {
    console.log("1. Starting mock test attempt for mock test ID 1...");
    const startRes = await fetch("http://localhost:5000/api/mock-tests/attempts/1/start", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    console.log("Start Response Status:", startRes.status);
    const attemptData = await startRes.json();
    console.log("Attempt ID:", attemptData.id);
    console.log("Questions Generated Count:", attemptData.questions.length);

    if (!attemptData.id) {
      throw new Error("Failed to start attempt");
    }

    const attemptId = attemptData.id;

    console.log("\n2. Updating attempt progress...");
    const progressRes = await fetch(`http://localhost:5000/api/mock-tests/attempts/${attemptId}/progress`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        currentQuestionIndex: 2,
        timeRemaining: 7100,
        grades: { "0": { score: 90, feedback: "Excellent", userResponse: "test answer" } }
      })
    });
    console.log("Progress Response Status:", progressRes.status);
    const progressData = await progressRes.json();
    console.log("Progress Response Data:", progressData);

    console.log("\n3. Listing all attempts...");
    const listRes = await fetch("http://localhost:5000/api/mock-tests/attempts", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    console.log("List Response Status:", listRes.status);
    const listData = await listRes.json();
    console.log("List Attempts Count:", listData.length);
    const currentAttempt = listData.find(a => a.ID === attemptId);
    console.log("Found Attempt in List:", currentAttempt ? "Yes" : "No");
    if (currentAttempt) {
      console.log("- Status:", currentAttempt.STATUS);
      console.log("- Current Question Index:", currentAttempt.CURRENT_QUESTION_INDEX);
      console.log("- Time Remaining:", currentAttempt.TIME_REMAINING);
      console.log("- Grades:", currentAttempt.GRADES);
    }

    console.log("\n4. Submitting completed attempt...");
    const submitRes = await fetch(`http://localhost:5000/api/mock-tests/attempts/${attemptId}/submit`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        grades: { "0": { score: 90, feedback: "Excellent", userResponse: "test answer" } },
        overallScore: 90,
        speakingScore: 90,
        writingScore: 90,
        readingScore: 90,
        listeningScore: 90
      })
    });
    console.log("Submit Response Status:", submitRes.status);
    const submitData = await submitRes.json();
    console.log("Submit Response Data:", submitData);

    console.log("\n5. Confirming status changed to completed in list...");
    const list2Res = await fetch("http://localhost:5000/api/mock-tests/attempts", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    const list2Data = await list2Res.json();
    const completedAttempt = list2Data.find(a => a.ID === attemptId);
    if (completedAttempt) {
      console.log("- Updated Status:", completedAttempt.STATUS);
      console.log("- Overall Score:", completedAttempt.OVERALL_SCORE);
    }

    console.log("\nAll API tests completed successfully!");
  } catch (err) {
    console.error("Test failed:", err);
  }
}

testFlow();
