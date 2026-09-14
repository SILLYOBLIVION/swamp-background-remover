const imageInput = document.getElementById("imageInput");
const removeButton = document.getElementById("removeButton");

const originalImage = document.getElementById("originalImage");
const originalSection = document.getElementById("originalSection");
const resultCanvas = document.getElementById("resultCanvas");

const status = document.getElementById("status");
const downloadButton = document.getElementById("downloadButton");

const loadingScreen = document.getElementById("loadingScreen");
const loadingText = document.getElementById("loadingText");
const progressFill = document.getElementById("progressFill");
const app = document.getElementById("app");

let selectedImage = null;
let processing = false;
let modelReady = false;
let currentResultURL = null;
let inferenceStartTime = null;
let lastInferenceTime = Number(
    localStorage.getItem("swampLastInferenceTime")
) || null;
const ERROR_MESSAGE =
    "yo sum fucked up idk text me if ts happens more than like 3 times";

const worker = new Worker(
    new URL("./worker.js", import.meta.url),
    {
        type: "module"
    }
);
function formatTime(seconds) {
    seconds = Math.max(1, Math.round(seconds));

    if (seconds < 60) {
        return `about ${seconds} seconds`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (remainingSeconds === 0) {
        return `about ${minutes} minute${minutes === 1 ? "" : "s"}`;
    }

    return `about ${minutes}m ${remainingSeconds}s`;
}
worker.addEventListener("message", async (event) => {
    const data = event.data;

    if (data.status === "starting-model") {
        console.log("WORKER STARTING MODEL");
        return;
    }

    if (data.status === "device") {
        console.log("Using device:", data.device);
        return;
    }

    if (data.status === "progress") {
        const progress = data.progress;
        if (progress?.status === "ready") {
            console.log("MODEL PROGRESS SAYS READY");
        }

        if (
            progress &&
            progress.status === "progress" &&
            typeof progress.progress === "number"
        ) {
            const percent = Math.round(progress.progress);

            progressFill.style.width = `${percent}%`;
            loadingText.textContent =
                `Loading resources... ${percent}%`;
        }

        if (progress?.status === "done") {
            loadingText.textContent = "Finishing setup...";
        }

        return;
    }

    if (data.status === "ready") {
        console.log("MAIN THREAD RECEIVED READY");

        modelReady = true;
        removeButton.disabled = false;

        progressFill.style.width = "100%";
        loadingText.textContent = "Ready.";

        setTimeout(() => {
            loadingScreen.classList.add("hidden");
            app.classList.remove("hidden");
        }, 300);

        return;
    }

    if (data.status === "processing") {
        inferenceStartTime = performance.now();

        if (lastInferenceTime) {
            status.textContent =
                `Removing background... Estimated time: ${formatTime(lastInferenceTime)}`;
        } else {
            status.textContent =
                "Removing background... Calibrating estimate...";
        }

        return;
    }

    if (data.status === "complete") {
        const actualInferenceTime =
            data.inferenceTime;

        lastInferenceTime = actualInferenceTime;

        localStorage.setItem(
            "swampLastInferenceTime",
            actualInferenceTime
        );

        console.log(
            `Actual inference time: ${actualInferenceTime.toFixed(2)} seconds`
        );
        try {
            if (currentResultURL) {
                URL.revokeObjectURL(currentResultURL);
                currentResultURL = null;
            }

            const blob = data.blob;

            currentResultURL = URL.createObjectURL(blob);

            const image = new Image();

            image.onload = () => {
                resultCanvas.width = image.width;
                resultCanvas.height = image.height;

                const ctx = resultCanvas.getContext("2d");

                ctx.clearRect(
                    0,
                    0,
                    resultCanvas.width,
                    resultCanvas.height
                );

                ctx.drawImage(
                    image,
                    0,
                    0,
                    resultCanvas.width,
                    resultCanvas.height
                );

                downloadButton.href = currentResultURL;
                downloadButton.download =
                    "background-removed.png";

                downloadButton.style.display = "inline-block";

                status.textContent =
                    `Done processing took like uhhhh ${formatTime(actualInferenceTime)}.`; status.textContent = "Done.";

                processing = false;
                removeButton.disabled = false;
            };

            image.onerror = () => {
                throw new Error("Could not display output image.");
            };

            image.src = currentResultURL;

        } catch (error) {
            console.error(error);

            status.textContent = ERROR_MESSAGE;

            processing = false;
            removeButton.disabled = false;
        }

        return;
    }

    if (data.status === "error") {
        console.error("Worker error:", data.message);

        status.textContent = ERROR_MESSAGE;

        processing = false;
        removeButton.disabled = false;
    }
});

imageInput.addEventListener("change", () => {
    const file = imageInput.files[0];

    if (!file) {
        return;
    }

    selectedImage = file;

    originalImage.src = URL.createObjectURL(file);
    originalSection.style.display = "block";

    downloadButton.style.display = "none";

    status.textContent = "Image loaded.";
});

removeButton.addEventListener("click", async () => {
    if (processing) {
        return;
    }

    if (!selectedImage) {
        status.textContent = "Pick an image first.";
        return;
    }

    if (!modelReady) {
        status.textContent = "Still loading.";
        return;
    }

    processing = true;
    removeButton.disabled = true;

    status.textContent = "Preparing image...";

    try {
        worker.postMessage({
            type: "remove",
            image: selectedImage
        });

    } catch (error) {
        console.error(error);

        status.textContent = ERROR_MESSAGE;

        processing = false;
        removeButton.disabled = false;
    }
});

removeButton.disabled = true;

worker.postMessage({
    type: "load"
});