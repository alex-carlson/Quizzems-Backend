import mongoose from "mongoose";

const ItemSchema = new mongoose.Schema({
    id: String,
    image: String,
    answer: String,
});

const CollectionsSchema = new mongoose.Schema({
    category: String,
    slug: String,
    author: String,
    private: Boolean,
    items: [ItemSchema],
});

export default mongoose.models.Collection || mongoose.model("Collection", CollectionsSchema);
