import {
    pipeline,
    env
} from "@huggingface/transformers";

env.remoteHost =
    `${self.location.origin}/hf`;

env.remotePathTemplate =
    "{model}/resolve/{revision}/{file}";

let remover = null;

async function loadModel() {
    if (remover) {
        return remover;
    }

    self.postMessage({
        status: "device",
        device: "wasm"
    });

    self.postMessage({
        status: "starting-model"
    });

    remover = await pipeline(
        "background-removal",
        "onnx-community/ormbg-ONNX",
        {
            device: "wasm",
            dtype: "q8",

            progress_callback: (progress) => {
                console.log("MODEL PROGRESS:", progress);

                self.postMessage({
                    status: "progress",
                    progress
                });
            }
        }
    );

    self.postMessage({
        status: "ready"
    });

    return remover;
}

async function resizeImage(file, maxSize = 1024) {
    const bitmap = await createImageBitmap(file);

    const originalWidth = bitmap.width;
    const originalHeight = bitmap.height;

    const scale = Math.min(
        1,
        maxSize / Math.max(originalWidth, originalHeight)
    );

    const width = Math.round(originalWidth * scale);
    const height = Math.round(originalHeight * scale);

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");

    ctx.drawImage(
        bitmap,
        0,
        0,
        width,
        height
    );

    bitmap.close();

    const blob = await canvas.convertToBlob({
        type: "image/png"
    });

    return {
        blob,
        width,
        height,
        originalWidth,
        originalHeight
    };
}

self.addEventListener("message", async (event) => {
    const data = event.data;

    try {
        if (data.type === "load") {
            await loadModel();
            return;
        }

        if (data.type === "remove") {
            const model = await loadModel();

            self.postMessage({
                status: "processing"
            });

            console.log("WORKER: resizing image");

            const resized = await resizeImage(
                data.image,
                1024
            );

            console.log(
                `WORKER: resized ${resized.originalWidth}x${resized.originalHeight} -> ${resized.width}x${resized.height}`
            );

            self.postMessage({
                status: "resized",
                width: resized.width,
                height: resized.height,
                originalWidth: resized.originalWidth,
                originalHeight: resized.originalHeight
            });

            console.log("WORKER: starting inference");

            const startTime = performance.now();

            const imageURL = URL.createObjectURL(
                resized.blob
            );

            const output = await model([imageURL]);

            URL.revokeObjectURL(imageURL);

            const inferenceTime =
                (performance.now() - startTime) / 1000;

            console.log(
                `WORKER: inference finished in ${inferenceTime.toFixed(2)} seconds`
            );

            if (!output || !output[0]) {
                throw new Error(
                    "No output was returned by the model."
                );
            }

            const blob = await output[0].toBlob();

            if (!blob) {
                throw new Error(
                    "Could not create output image."
                );
            }

            self.postMessage({
                status: "complete",
                blob,
                inferenceTime,
                processedWidth: resized.width,
                processedHeight: resized.height,
                originalWidth: resized.originalWidth,
                originalHeight: resized.originalHeight
            });
        }
    } catch (error) {
        console.error(error);

        self.postMessage({
            status: "error",
            message: error?.message || String(error)
        });
    }
});