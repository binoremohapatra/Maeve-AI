import requests
import os

def download_file(url, filename):
    print(f" Downloading {filename}...")
    response = requests.get(url, stream=True)
    if response.status_code == 200:
        with open(filename, 'wb') as f:
            for chunk in response.iter_content(1024):
                f.write(chunk)
        print(f"{filename} Saved!")
    else:
        print(f"Failed to download {filename}")

# URLs for NEW Kokoro v1.0 models
onnx_url = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/v1.0.0/kokoro-v1.0.int8.onnx"
voices_url = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/v1.0.0/voices-v1.0.bin"

if __name__ == "__main__":
    # Download to root level (same folder as app.py)
    if not os.path.exists("kokoro-v1.0.int8.onnx"):
        download_file(onnx_url, "kokoro-v1.0.int8.onnx")
    else:
        print("⚡ kokoro-v1.0.int8.onnx already exists.")

    if not os.path.exists("voices-v1.0.bin"):
        download_file(voices_url, "voices-v1.0.bin")
    else:
        print("voices-v1.0.bin already exists.")
    
    print("\nAll set! Now run: python app.py")
