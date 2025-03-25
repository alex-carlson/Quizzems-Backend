import User from '../models/userModel.js';
import jwt from 'jsonwebtoken';

export const createUser = (req, res) => {
    const { username, email, password } = req.body;

    if (!username) {
        return res.status(400).json({ error: 'Username is required' });
    }

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    if (!password) {
        return res.status(400).json({ error: 'Password is required' });
    }

    const newUser = new User(username, email, password);

    newUser.register((error, data) => {
        if (error) {
            return res.status(400).json({ error: 'User could not be created' });
        }

        return res.status(201).json({ message: 'User created successfully' });
    });
};

export const loginUser = (req, res) => {
    const { email, username, password } = req.body;

    if (!email && !username) {
        return res.status(400).json({ error: 'Email or username is required' });
    }

    if (!password) {
        return res.status(400).json({ error: 'Password is required' });
    }

    User.login(email || username, password, (error, user) => {
        if (error) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ user }, process.env.JWT_SECRET, { expiresIn: '14d' });
        return res.status(200).json({ user, token });
    });
};