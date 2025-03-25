import User from '../models/userModel.js';

export const getAllUsers = (req, res) => {
    res.json(User.getAll());
};

export const createUser = (req, res) => {
    const newUser = User.create(req.body);
    res.status(201).json(newUser);
};
