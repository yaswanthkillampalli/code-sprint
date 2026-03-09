require('dotenv').config();
const mongoose = require('mongoose');
const Question = require('./models/Question');

const questions = [
  {
    title: "Addition of Two Numbers",
    difficulty: "Easy",
    points: 10,
    task: "Complete the function to return the sum of two integers `a` and `b`.",
    description: "This is a basic warm-up problem to test the environment.",
    constraints: "-10^9 <= a, b <= 10^9",
    inputFormat: "Two space-separated integers a and b.",
    outputFormat: "A single integer representing the sum.",
    examples: [
      { input: "5 10", output: "15", explanation: "5 + 10 = 15" }
    ],
    templates: {
        java: {
            visibleCode: "class Solution {\n    public int add(int a, int b) {\n        // Write your code here\n        return 0;\n    }\n}",
            hiddenDriver: "import java.util.*;\n\n{{USER_CODE}}\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.getProperty(\"os.name\").contains(\"Windows\") ? System.in : System.in);\n        if(sc.hasNextInt()) {\n            int a = sc.nextInt();\n            int b = sc.nextInt();\n            Solution obj = new Solution();\n            System.out.println(obj.add(a, b));\n        }\n    }\n}"
        },
        cpp: {
            visibleCode: "class Solution {\npublic:\n    int add(int a, int b) {\n        // Write your code here\n        return 0;\n    }\n};",
            hiddenDriver: "#include <iostream>\nusing namespace std;\n\n{{USER_CODE}}\n\nint main() {\n    int a, b;\n    if(cin >> a >> b) {\n        Solution obj;\n        cout << obj.add(a, b) << endl;\n    }\n    return 0;\n}"
        },
        python: {
            visibleCode: "class Solution:\n    def add(self, a: int, b: int) -> int:\n        # Write your code here\n        return 0",
            hiddenDriver: "import sys\n\n{{USER_CODE}}\n\nif __name__ == '__main__':\n    data = sys.stdin.read().split()\n    if len(data) >= 2:\n        a, b = int(data[0]), int(data[1])\n        obj = Solution()\n        print(obj.add(a, b))"
        }
    },
    hiddenTestCases: [
      { input: "100 200", output: "300" },
      { input: "-5 5", output: "0" }
    ]
  },
  {
    title: "Prime Numbers in Range M to N",
    difficulty: "Medium",
    points: 20,
    task: "Find all prime numbers between a given range [M, N] (inclusive).",
    description: "You need to return the count of prime numbers in the range.",
    constraints: "1 <= M <= N <= 10^5",
    inputFormat: "Two integers M and N.",
    outputFormat: "A single integer representing the count of primes.",
    examples: [
      { input: "1 10", output: "4", explanation: "Primes between 1 and 10 are 2, 3, 5, 7." }
    ],
    templates: {
      cpp: {
        visibleCode: "class Solution {\npublic:\n    int countPrimes(int M, int N) {\n        // Write your code here\n        return 0;\n    }\n};",
        hiddenDriver: "#include <iostream>\nusing namespace std;\n\n{{USER_CODE}}\n\nint main() {\n    int m, n;\n    if(cin >> m >> n) {\n        Solution obj;\n        cout << obj.countPrimes(m, n) << endl;\n    }\n    return 0;\n}"
      },
      python: {
        visibleCode: "class Solution:\n    def countPrimes(self, M: int, N: int) -> int:\n        # Write your code here\n        return 0",
        hiddenDriver: "import sys\n\n{{USER_CODE}}\n\nif __name__ == '__main__':\n    data = sys.stdin.read().split()\n    if len(data) >= 2:\n        m, n = int(data[0]), int(data[1])\n        obj = Solution()\n        print(obj.countPrimes(m, n))"
      }
    },
    hiddenTestCases: [
      { input: "10 20", output: "4" }, // 11, 13, 17, 19
      { input: "1 2", output: "1" }
    ]
  }
];

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log("Connected to MongoDB for seeding...");
    await Question.deleteMany({}); // Clear existing questions
    await Question.insertMany(questions);
    console.log("✅ Successfully seeded 2 problems!");
    process.exit();
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });