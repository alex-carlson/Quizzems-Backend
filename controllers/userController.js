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

    console.log("Logging in with info: ", email, username, password);

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

export const forgotPassword = (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    User.forgotPassword(email, (error, data) => {
        if (error) {
            return res.status(400).json({ error: 'Password reset could not be initiated' });
        }

        return res.status(200).json({ message: 'Password reset initiated' });
    });
}

export const resetPassword = (req, res) => {
    const { email, password, token } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    return User.resetPassword(email, password, token, (error, data) => {
        if (error) {
            return res.status(400).json({ error: 'Password reset could not be completed' });
        }

        return res.status(200).json({ message: 'Password reset completed' });
    });
}

export const getUser = (req, res) => {
    const { id } = req.params;

    console.log("Fetching user with ID:", id);

    if (!id) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    User.getUser(id, (error, user) => {
        if (error) {
            return res.status(400).json({ error: 'User not found' });
        }

        return res.status(200).json({ user });
    });
};

export const changeUsername = (req, res) => {
    const { newUsername, email, oldUsername } = req.body;

    console.log("Changing username for user:", email, oldUsername, newUsername);

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    if (!newUsername) {
        return res.status(400).json({ error: 'New username is required' });
    }

    if (!oldUsername) {
        return res.status(400).json({ error: 'Old username is required' });
    }

    User.changeUsername(email, newUsername, oldUsername, (error, data) => {
        if (error) {
            return res.status(400).json({ error: 'Username change failed' });
        }

        return res.status(200).json({ message: 'Username changed successfully' });
    });
}