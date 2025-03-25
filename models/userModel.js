import supabase from '../config/supabaseClient.js';
import bcrypt from 'bcryptjs';

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

        // Fetch user from Supabase
        supabase
            .from('users')
            .select('id, username, email, password') // Ensure password is included for comparison
            .eq(queryField, identifier)
            .single()
            .then(({ data, error }) => {
                if (error || !data) return callback(new Error('Invalid username or email'), null);

                // Compare password
                bcrypt.compare(password, data.password)
                    .then(isMatch => {
                        if (!isMatch) return callback(new Error('Invalid credentials'), null);

                        // Return username
                        callback(null, data.username);
                    })
                    .catch(err => callback(err, null));
            })
            .catch(err => callback(err, null));
    }
}

export default User;