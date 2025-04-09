// take in the body of the request and sanitize it
// and return the sanitized body

import { sanitize, body } from 'express-validator';

export const sanitizeBody = (req) => {
    // Sanitize the request body
    const sanitizedBody = sanitize(req.body, {
        trim: true,
        escape: true,
    });

    // Assign the sanitized body back to req.body
    req.body = sanitizedBody;
}