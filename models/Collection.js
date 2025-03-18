import mongoose from "mongoose";

const CollectionsSchema = new mongoose.Schema({
    category: String,
    author: String,
    items: [{ image: String, text: String }]
});

export default mongoose.models.Collection || mongoose.model("Collection", CollectionsSchema);
