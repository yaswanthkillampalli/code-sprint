const bcrypt = require('bcrypt');

// The password you want to hash
const passwordToHash = "9876543210"; 
const saltRounds = 10;

const generateHash = async () => {
    try {
        const hash = await bcrypt.hash(passwordToHash, saltRounds);
        console.log("-----------------------------------------");
        console.log("ORIGINAL PASSWORD:", passwordToHash);
        console.log("GENERATED HASH:", hash);
        console.log("-----------------------------------------");
        console.log("Copy the hash above and paste it into the 'password' field in MongoDB Compass.");
    } catch (err) {
        console.error("Error generating hash:", err);
    }
};

generateHash(); 