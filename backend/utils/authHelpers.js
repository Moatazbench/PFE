const isAdmin = (user) => {
    return user && user.role === 'ADMIN';
};

const isOwnerOrAdmin = (user, resourceOwnerId) => {
    if (isAdmin(user)) return true;
    return String(user.id || user._id) === String(resourceOwnerId);
};

module.exports = {
    isAdmin,
    isOwnerOrAdmin
};
