import supabase from '../config/supabaseClient.js';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
// import * as googleauth from '../middleware/googleauth.js';

class User {
    constructor(username, email, password) {
        this.username = username;
        this.email = email;
        this.password = password;
    }

    register(callback) {
        const saltRounds = 10;
        bcrypt.hash(this.password, saltRounds).then((hashedPassword) => {
            supabase
                .from('users')
                .insert([{ username: this.username, email: this.email, password: hashedPassword }])
                .select()
                .then(({ data, error }) => {
                    if (error) {
                        console.log('Error inserting user:', error);
                        callback(error, null);
                    } else {
                        callback(null, data);
                    }
                });
        }).catch((error) => {
            console.log('Error hashing password:', error);
            callback(error, null);
        });
    }

    // Login user (Check hashed password & return user data)
    static login(identifier, password, callback) {
        // Check if identifier is email or username
        const queryField = identifier.includes('@') ? 'email' : 'username';

        console.log("Logging in user:", identifier, "with field:", queryField);

        // Fetch user from Supabase
        supabase
            .from('users')
            .select('username, email, password') // Ensure password is included for comparison
            .ilike(queryField, identifier) // Use ilike for case-insensitive comparison
            .single()
            .then(({ data, error }) => {
                if (error || !data) return callback(new Error('Invalid username or email'), null);

                console.log("found a user, checking password");

                // Compare password
                bcrypt.compare(password, data.password)
                    .then(isMatch => {
                        if (!isMatch) return callback(new Error('Invalid credentials'), null);
                        console.log("Password matched, returning user data");
                        // Return username
                        callback(null, data.username);
                    })
                    .catch(err => callback(err, null));
            })
            .catch(err => callback(err, null));
    }

    // Forgot password (Send reset link to email)
    static async forgotPassword(email, callback) {
        try {
            // Generate reset token
            const resetToken = Math.random().toString(36).substring(2, 15);

            console.log("Resetting password for user:", email);

            const { error } = await supabase
                .from('users')
                .update({ resetToken })
                .ilike('email', email);

            if (error) return callback(error, null);

            // googleauth.setRefreshToken(process.env.REFRESH_TOKEN);

            // const accessToken = await googleauth.getAccessToken();

            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS,
                },
            });

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'Password Reset Link',
                text: `Click the link below to reset your password:\n\n${process.env.CLIENT_URL}/#/reset-password?email=${email}&token=${resetToken}`,
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.log('Error sending email:', error);
                    callback(error, null);
                } else {
                    console.log('Email sent:', info.response);
                    callback(null, 'Password reset initiated');
                }
            });
        } catch (error) {
            console.log('Error initiating password reset:', error);
            callback(error, null);
        }
    }

    // Reset password (Update user password)
    static resetPassword(email, password, token, callback) {
        console.log("Updating password for user:", email);
        // Hash new password
        bcrypt.hash(password, 10).then((hashedPassword) => {
            // Update user password
            supabase
                .from('users')
                .update({ password: hashedPassword, resetToken: null })
                .ilike('email', email)
                .eq('resetToken', token)
                .then(({ error }) => {
                    if (error) return callback(error, null);

                    callback(null, 'Password reset completed');
                })
                .catch(err => callback(err, null));
        }).catch((error) => {
            callback(error, null);
        });
    }

    // Get user by ID
    static getUser(id, callback) {
        // return user email and username from supabase where id matches username
        supabase
            .from('users')
            .select('email, username')
            .eq('username', id)
            .single()
            .then(({ data, error }) => {
                if (error) return callback(error, null);

                callback(null, data);
            })
            .catch(err => callback(err, null));
    }

    static async changeUsername(email, newUsername, oldUsername, callback) {
        try {
            // Update user username
            const { error: userError } = await supabase
                .from('users')
                .update({ username: newUsername })
                .ilike('email', email)
                .eq('username', oldUsername);

            if (userError) return callback(userError, null);

            // Update collections authored by user
            const { error: collectionError } = await supabase
                .from('collections')
                .update({ author: newUsername })
                .ilike('author', oldUsername);

            if (collectionError) return callback(collectionError, null);

            // All good
            callback(null, 'Username changed successfully');
        } catch (err) {
            callback(err, null);
        }
    }

}

export default User;