import { unlink } from 'fs/promises';

export async function removeFile(path) {
    try {
        await unlink(path)
    } catch (error) {
        console.log('Error while do removeFile function:',error.message);
    }
};

export function isUserHasAccess(list, userId) {
    for (let id of list) {
        if (userId === id) {
            return true;
        };
    };
    return false;
};