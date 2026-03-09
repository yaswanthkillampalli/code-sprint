export const loginUser = async (username, password) => {
  await new Promise((resolve) => setTimeout(resolve, 800));

  if (username && password) {
    return {
      success: true,
      data: {
        username: username,
        currentSessionId: "session_mock_12345",
        role: "participant",
        globalStatus: "waiting"
      }
    };
  }

  return {
    success: false,
    error: "Invalid Roll Number or Phone Number"
  };
};

// Add this to your existing lib/mockApi.js

export const getExamStatus = async () => {
  await new Promise((resolve) => setTimeout(resolve, 500));
  
  return {
    success: true,
    data: {
      status: "waiting", // Change to "countdown" to test the timer
      targetStartTime: null, 
      durationMinutes: 120,
      totalQuestions: 6,
      maxScore: 240
    }
  };
};

// Add this to your existing lib/mockApi.js

export const getProblemsList = async () => {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 500));
  
  return {
    success: true,
    data: [
      {
        id: "q1",
        title: "Count Substrings with K Distinct Characters",
        xp: 40,
        testCasesTotal: 4,
        testCasesPassed: 4,
        score: 40,
        status: "SOLVED" // "SOLVED", "ATTEMPTED", or "UNATTEMPTED"
      },
      {
        id: "q2",
        title: "Valid Binary Search Tree",
        xp: 40,
        testCasesTotal: 5,
        testCasesPassed: 2,
        score: 16,
        status: "ATTEMPTED"
      },
      {
        id: "q3",
        title: "Minimum Path Sum",
        xp: 60,
        testCasesTotal: 10,
        testCasesPassed: 0,
        score: 0,
        status: "UNATTEMPTED"
      },
      {
        id: "q4",
        title: "Alien Dictionary",
        xp: 100,
        testCasesTotal: 12,
        testCasesPassed: 0,
        score: 0,
        status: "UNATTEMPTED"
      }
    ]
  };
};

// Add this to your existing lib/mockApi.js

export const getProblemDetails = async (id) => {
  await new Promise((resolve) => setTimeout(resolve, 500));

  return {
    success: true,
    data: {
      id: id,
      title: "Count Substrings with K Distinct Characters",
      difficulty: "Medium",
      xp: 15,
      description: `Given a string \`s\` and an integer \`k\`, your task is to return the count of substrings in \`s\` that contain exactly \`k\` distinct characters.

**Example 1:**
**Input:**
\`\`\`text
s = "bcb"
k = 2
\`\`\`
**Output:**
\`\`\`text
3
\`\`\`

**Explanation:**
Substrings of length 2 or more with exactly 2 distinct characters are:
* "bc", "cb", "bcb"
      `,
      sampleTestCases: [
        { id: 1, input: "bcb\n2", expectedOutput: "3" },
        { id: 2, input: "aba\n2", expectedOutput: "2" }
      ]
    }
  };
};

// POST /api/submissions
app.post('/api/submissions', async (req, res) => {
  try {
    const { userId, questionId, language, userCode } = req.body;

    // STEP 1: Fetch the Question & Templates from MongoDB
    const question = await Question.findById(questionId);
    if (!question) return res.status(404).json({ error: "Question not found" });

    // STEP 2: Stitch the Code
    const driverTemplate = question.templates[language].hiddenDriver;
    const finalCode = driverTemplate.replace("{{USER_CODE}}", userCode);

    // STEP 3: Map the Language to Judge0 IDs
    // Judge0 uses specific IDs for languages (e.g., 54 = C++, 71 = Python, 62 = Java)
    const languageIdMap = { "cpp": 54, "python": 71, "java": 62 };
    const judge0LangId = languageIdMap[language];

    // STEP 4: Send to Judge0 (Using the Batch Submission feature)
    // We send the stitched code along with all hidden test cases
    const submissionsPayload = question.hiddenTestCases.map(tc => ({
      language_id: judge0LangId,
      source_code: finalCode,
      stdin: tc.input,
      expected_output: tc.output
    }));

    // Make the API call to your Azure Judge0 VM
    const judgeResponse = await axios.post(
      'http://YOUR_AZURE_JUDGE_IP:2358/submissions/batch?base64_encoded=false&wait=true', 
      { submissions: submissionsPayload }
    );

    // STEP 5: Calculate the Score & Update DB
    let passedCount = 0;
    const results = judgeResponse.data.map(submission => {
      // Judge0 status 3 means "Accepted"
      const passed = submission.status.id === 3; 
      if (passed) passedCount++;
      return {
        passed,
        actualOutput: submission.stdout,
        error: submission.stderr || submission.compile_output
      };
    });

    const currentScore = (passedCount / question.hiddenTestCases.length) * question.points;

    // Update the User's document in MongoDB here...
    
    // Return the visual results to the Next.js frontend
    res.json({
      success: true,
      passedCount,
      totalCount: question.hiddenTestCases.length,
      scoreObtained: currentScore,
      results
    });

  } catch (error) {
    console.error("Submission Error:", error);
    res.status(500).json({ error: "Failed to evaluate code" });
  }
});

// Add this to your existing lib/mockApi.js

export const loginAdmin = async (adminId, password) => {
  // Simulate network delay to make the demo feel real
  await new Promise((resolve) => setTimeout(resolve, 800));

  // Hardcoded secure credentials for your demo
  if (adminId === "admin" && password === "10xdevs2026") {
    return {
      success: true,
      data: {
        role: "admin",
        name: "Super Admin",
        sessionId: "admin_secure_session_999"
      }
    };
  }

  return {
    success: false,
    error: "Unauthorized: Invalid Admin Credentials"
  };
};