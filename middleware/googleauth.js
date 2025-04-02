import { google } from "googleapis";

export const clientId = process.env.CLIENT_ID;
export const clientSecret = process.env.CLIENT_SECRET;

const oauth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.REDIRECT_URI
);

// Generate a URL for authorization
const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/gmail.send"],
});

console.log("Authorize this app by visiting:", authUrl);

// Function to set the refresh token
export function setRefreshToken(refreshToken) {
    oauth2Client.setCredentials({ refresh_token: refreshToken });
}

// Function to get an access token
export async function getAccessToken() {
    try {
        const { token } = await oauth2Client.getAccessToken();
        return token;
    } catch (error) {
        console.error("Error fetching access token:", error.response?.data || error.message);
        throw error;
    }
}

async function testOAuth() {
    try {
        setRefreshToken(process.env.REFRESH_TOKEN);
        const accessToken = await getAccessToken();
        console.log("Access Token:", accessToken);
    } catch (error) {
        console.error("OAuth Test Error:", error.response?.data || error.message);
    }
}

testOAuth();