const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

const suspectedFiles = [
    'components/MaeveAvatar.tsx',
    'components/VRMStage.tsx',
    'components/VRMStage.jsx',
    'components/EnvironmentManager.tsx',
    'components/BackgroundController.tsx',
    'components/EmotionOverlayController.tsx',
    'components/MascotCenterStage.tsx',
    'components/MascotBubbleLayer.tsx',
    'components/SpeechBubble.tsx',
    'components/CursorEffect.tsx',
    'components/DebugStatus.tsx',
    'components/DeskProps.tsx',
    'components/MissionControlWidget.tsx',
    'components/UniversalStudioStage.tsx',
    'components/MaeveAvatarIntegration.tsx',
    'controllers/MotionManager.ts',
    'utils/MotionManager.js',
    'utils/lipSync.ts',
    'utils/boneAudit.ts',
    'utils/BehaviorMapper.js',
    'utils/BehaviorMapper.ts',
    'engine/emotionOverlays.ts',
    'engine/personaThemes.ts',
    'stores/wardrobeStore.ts',
    'hooks/useScreenSize.ts'
    // I excluded UIControls.tsx from auto-delete because it might be tricky. I will verify it manually if needed, though it is imported in VRMScene.tsx!
];

function getAllFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            getAllFiles(fullPath, fileList);
        } else {
            if (fullPath.match(/\.(ts|tsx|js|jsx)$/)) {
                fileList.push(fullPath);
            }
        }
    }
    return fileList;
}

const allFiles = getAllFiles(srcDir);
const safeToDelete = [];

suspectedFiles.forEach(relPath => {
    const targetPath = path.join(srcDir, relPath);
    if (!fs.existsSync(targetPath)) return;

    const ext = path.extname(relPath);
    const basename = path.basename(relPath, ext);

    let isImported = false;
    let importedIn = [];

    // Scan all files
    allFiles.forEach(f => {
        if (f === targetPath) return; // ignore self
        
        // Note: we can't reliably read very large files sequentially in a simple script if there are 1000s, 
        // but for a React project it's fast enough.
        const content = fs.readFileSync(f, 'utf8');
        
        // look for imports of the basename, e.g. "import { Something } from './MascotBubbleLayer'"
        // or dynamic imports. 
        // A simple string include is very safe (false positives prevent deletion, which is safe).
        if (content.includes(basename)) {
            isImported = true;
            importedIn.push(f.replace(srcDir, ''));
        }
    });

    if (!isImported) {
        console.log(`[DEAD] ${relPath} - Zero imports found.`);
        safeToDelete.push({ path: targetPath, reason: '0 imports found, not an entry point' });
    } else {
        console.log(`[USED] ${relPath} - Imported in: ${importedIn.slice(0, 3).join(', ')}`);
    }
});

console.log("\\n=== Deleting Confirmed Dead Files ===");
safeToDelete.forEach(item => {
    fs.unlinkSync(item.path);
    console.log(`Deleted: ${item.path} (${item.reason})`);
});
console.log("Done.");
