import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// Define the User Schema
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true, match: /.+\@.+\..+/ },  // Email validation
    password: { type: String, required: true },
}, { timestamps: true });

// Hash password before saving
UserSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

// Compare password method
UserSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Prevent OverwriteModelError
const User = mongoose.models.User || mongoose.model('User', UserSchema);

export default User; // ✅ Make sure it's a default export
