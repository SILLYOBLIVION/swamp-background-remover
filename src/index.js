export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (url.pathname.startsWith("/hf/")) {
            if (request.method === "OPTIONS") {
                return new Response(null, {
                    status: 204,
                    headers: {
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
                        "Access-Control-Allow-Headers": "*"
                    }
                });
            }

            const hfPath = url.pathname.slice(4);

            const hfURL =
                "https://huggingface.co/" +
                hfPath +
                url.search;

            const response = await fetch(hfURL, {
                method: request.method,
                redirect: "follow"
            });

            const headers = new Headers();

            const contentType =
                response.headers.get("Content-Type");

            if (contentType) {
                headers.set("Content-Type", contentType);
            }

            const contentLength =
                response.headers.get("Content-Length");

            if (contentLength) {
                headers.set(
                    "Content-Length",
                    contentLength
                );
            }

            headers.set(
                "Access-Control-Allow-Origin",
                "*"
            );

            headers.set(
                "Access-Control-Allow-Methods",
                "GET, HEAD, OPTIONS"
            );

            headers.set(
                "Access-Control-Allow-Headers",
                "*"
            );

            return new Response(
                response.body,
                {
                    status: response.status,
                    headers
                }
            );
        }

        return env.ASSETS.fetch(request);
    }
};