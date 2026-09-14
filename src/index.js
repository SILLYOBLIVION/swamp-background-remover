export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (url.pathname.startsWith("/hf/")) {
            const hfPath = url.pathname.slice(4);

            const hfURL =
                "https://huggingface.co/" + hfPath + url.search;

            const response = await fetch(hfURL, {
                method: request.method,
                headers: request.headers,
                redirect: "follow"
            });

            const headers = new Headers(response.headers);

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
                    statusText: response.statusText,
                    headers
                }
            );
        }

        return env.ASSETS.fetch(request);
    }
};