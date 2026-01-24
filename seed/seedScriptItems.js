require("dotenv").config();
const mongoose = require("mongoose");
const Item = require("../server/models/item");
const itemSeedData = require("./items.json");

const mongoConnectionURL = process.env.MONGO_SRV;
const databaseName = "questlog";

async function updateSeedData() {
  for (const data of itemSeedData) {
    await Item.updateOne(
      { key: data.key },   // 👈 stable identifier
      { $set: data },
      { upsert: true }
    );
  }
}

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
    console.log("Successfully Updated Item Seed (and disconnected)");
  })
  .catch((err) => console.log(`Error connecting to MongoDB: ${err}`));
