const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const baseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!baseUrl || !serviceKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

async function request(path, options = {}) {
    const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
        ...options,
        headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
            ...options.headers
        }
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`Supabase ${response.status}: ${body}`);
    }

    if (response.status === 204) return null;
    return response.json();
}

module.exports = {
    select(table, query = "") {
        return request(`${table}?${query}`);
    },
    insert(table, values) {
        return request(table, {
            method: "POST",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify(values)
        });
    },
    update(table, query, values) {
        return request(`${table}?${query}`, {
            method: "PATCH",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify(values)
        });
    },
    async checkConnection() {
        await request("users?select=id&limit=1");
    }
};
