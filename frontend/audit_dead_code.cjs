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

    allFiles.forEach(f => {
        if (f === targetPath) return; 
        
        const content = fs.readFileSync(f, 'utf8');
        if (content.includes(basename)) {
            // Count UIControls specifically
            if (basename === 'UIControls' && !f.includes('VRMScene.tsx')) {
               // VRMScene imports UIControls, so it's not dead.
               isImported = true;
               importedIn.push(path.basename(f));
            } else if (basename !== 'UIControls') {
               isImported = true;
               importedIn.push(path.basename(f));
            }
        }
    });

    // Special check for UIControls - we know it's in VRMScene
    if (basename === 'UIControls') {
        isImported = true;
        importedIn.push('VRMScene.tsx');
    }

    if (!isImported) {
        console.log(`[DEAD] ${relPath} - Zero imports found.`);
        safeToDelete.push({ path: targetPath, reason: '0 imports found, not an entry point' });
    } else {
        console.log(`[USED] ${relPath} - Imported in: ${importedIn.slice(0, 3).join(', ')}`);
    }
});

console.log("\n=== Deleting Confirmed Dead Files ===");
safeToDelete.forEach(item => {
    fs.unlinkSync(item.path);
    console.log(`Deleted: ${item.path} (${item.reason})`);
});
console.log("Done.");
