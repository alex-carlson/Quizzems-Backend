const users = [];

const User = {
    getAll: () => users,
    create: (user) => {
        users.push(user);
        return user;
    },
};

export default User;
