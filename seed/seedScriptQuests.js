require("dotenv").config();
const mongoose = require("mongoose");
const Quest = require("../server/models/quest");
const questSeedData = require("./quests.json");

// connect mongo DB
const mongoConnectionURL = process.env.MONGO_SRV;
const databaseName = "questlog";

// function to update/add the Seed Data to mongoDB
async function updateSeedData() {
  for (const data of questSeedData) {
    await Quest.updateOne({ questKey: data.questKey }, { $set: data }, { upsert: true });
  }
}

// connects to mongoDB, updates data, then disconnects
mongoose
  .connect(mongoConnectionURL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    dbName: databaseName,
  })
  .then(async () => {
    console.log("Connected to MongoDB");
    await updateSeedData();
    await mongoose.disconnect();
    console.log("Successfully Updated Quest Seed (and disconnected)");
  })
  .catch((err) => console.log(`Error connecting to MongoDB: ${err}`));
