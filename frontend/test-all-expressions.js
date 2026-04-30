// Comprehensive Expression Preset Test Suite
// This can be run in the browser console when the app is running

// Test FocusedTeaseFace preset
function testFocusedTeaseFace() {
    const vrm = window.currentVrm;
    if (!vrm) {
        console.error(' VRM not found. Make sure the app is running and VRM is loaded.');
        return;
    }

    const controller = window.mainCharacterController;
    if (!controller) {
        console.error(' MainCharacterController not found globally.');
        return;
    }

    console.log(' Testing FocusedTeaseFace preset...');

    // Test 1: Basic FocusedTeaseFace
    console.log(' Test 1: Basic FocusedTeaseFace');
    controller.activateFocusedTeaseFace(1.0);

    // Test 2: Dynamic FocusedTeaseFace after 2 seconds
    setTimeout(() => {
        console.log(' Test 2: Dynamic FocusedTeaseFace');
        controller.activateFocusedTeaseFaceDynamic();
    }, 2000);

    // Test 3: Reset after 4 seconds
    setTimeout(() => {
        console.log(' Test 3: Reset expressions');
        const expManager = vrm.expressionManager;
        if (expManager) {
            const allExpressions = ['happy', 'angry', 'sad', 'relaxed', 'surprised', 'neutral', 'blink', 'aa', 'ih', 'oh', 'ou', 'tongue_out', 'tongueOut', 'blush'];
            allExpressions.forEach(exp => expManager.setValue(exp, 0.0));
        }
    }, 4000);

    console.log(' FocusedTeaseFace tests scheduled. Check for intense, focused, teasing expression.');
}

// Test DramaticOpenMouthFace preset
function testDramaticOpenMouthFace() {
    const vrm = window.currentVrm;
    if (!vrm) {
        console.error(' VRM not found. Make sure the app is running and VRM is loaded.');
        return;
    }

    const controller = window.mainCharacterController;
    if (!controller) {
        console.error(' MainCharacterController not found globally.');
        return;
    }

    console.log(' Testing DramaticOpenMouthFace preset...');

    // Test 1: Basic DramaticOpenMouthFace
    console.log(' Test 1: Basic DramaticOpenMouthFace');
    controller.activateDramaticOpenMouthFace(1.0);

    // Test 2: Reset after 3 seconds
    setTimeout(() => {
        console.log(' Test 2: Reset expressions');
        const expManager = vrm.expressionManager;
        if (expManager) {
            const allExpressions = ['happy', 'angry', 'sad', 'relaxed', 'surprised', 'neutral', 'blink', 'aa', 'ih', 'oh', 'ou', 'tongue_out', 'tongueOut', 'blush'];
            allExpressions.forEach(exp => expManager.setValue(exp, 0.0));
        }
    }, 3000);

    console.log(' DramaticOpenMouthFace tests scheduled. Check for dramatic open-mouth expression.');
}

// Test OverwhelmedFace preset
function testOverwhelmedFace() {
    const vrm = window.currentVrm;
    if (!vrm) {
        console.error(' VRM not found. Make sure the app is running and VRM is loaded.');
        return;
    }

    const controller = window.mainCharacterController;
    if (!controller) {
        console.error(' MainCharacterController not found globally.');
        return;
    }

    console.log(' Testing OverwhelmedFace preset...');

    // Test 1: Basic OverwhelmedFace
    console.log(' Test 1: Basic OverwhelmedFace');
    controller.activateOverwhelmedFace(1.0);

    // Test 2: Dynamic OverwhelmedFace after 2 seconds
    setTimeout(() => {
        console.log(' Test 2: Dynamic OverwhelmedFace');
        controller.activateOverwhelmedFaceDynamic();
    }, 2000);

    // Test 3: Reset after 4 seconds
    setTimeout(() => {
        console.log(' Test 3: Reset expressions');
        const expManager = vrm.expressionManager;
        if (expManager) {
            const allExpressions = ['happy', 'angry', 'sad', 'relaxed', 'surprised', 'neutral', 'blink', 'aa', 'ih', 'oh', 'ou', 'tongue_out', 'tongueOut', 'blush'];
            allExpressions.forEach(exp => expManager.setValue(exp, 0.0));
        }
    }, 4000);

    console.log(' OverwhelmedFace tests scheduled. Check for intense, strained expression.');
}

// Test SoftBreathFace preset
function testSoftBreathFace() {
    const vrm = window.currentVrm;
    if (!vrm) {
        console.error(' VRM not found. Make sure the app is running and VRM is loaded.');
        return;
    }

    const controller = window.mainCharacterController;
    if (!controller) {
        console.error(' MainCharacterController not found globally.');
        return;
    }

    console.log(' Testing SoftBreathFace preset...');

    // Test 1: Basic SoftBreathFace
    console.log(' Test 1: Basic SoftBreathFace');
    controller.activateSoftBreathFace(1.0);

    // Test 2: Dynamic SoftBreathFace after 2 seconds
    setTimeout(() => {
        console.log(' Test 2: Dynamic SoftBreathFace');
        controller.activateSoftBreathFaceDynamic();
    }, 2000);

    // Test 3: Reset after 4 seconds
    setTimeout(() => {
        console.log(' Test 3: Reset expressions');
        const expManager = vrm.expressionManager;
        if (expManager) {
            const allExpressions = ['happy', 'angry', 'sad', 'relaxed', 'surprised', 'neutral', 'blink', 'aa', 'ih', 'oh', 'ou', 'tongue_out', 'tongueOut', 'blush'];
            allExpressions.forEach(exp => expManager.setValue(exp, 0.0));
        }
    }, 4000);

    console.log(' SoftBreathFace tests scheduled. Check for flushed, vulnerable expression.');
}

// Auto-detect animation changes for all presets
function monitorAllAnimations() {
    const controller = window.mainCharacterController;
    if (!controller) return;

    setInterval(() => {
        const currentAction = controller.animationController?.currentActionName;
        if (['BLOWJOB', 'BACKSHOT', 'MASTURBATE'].includes(currentAction)) {
            console.log(` PleasureFace should be active for: ${currentAction}`);
        } else if (['AHEGAO'].includes(currentAction)) {
            console.log(` WildExcitedFace should be active for: ${currentAction}`);
        } else if (['BACKSHOT2', 'BLOWJOB3'].includes(currentAction)) {
            console.log(` OverwhelmedFace should be active for: ${currentAction}`);
        } else if (['BLOWJOB2', 'BACKSHOT3'].includes(currentAction)) {
            console.log(` SoftBreathFace should be active for: ${currentAction}`);
        } else if (['CLOSE_INTENSE', 'FOCUSED_TEASE'].includes(currentAction)) {
            console.log(` FocusedTeaseFace should be active for: ${currentAction}`);
        } else if (['INTENSE_MODE', 'DOMINANT_ROAR', 'BATTLE_SCREAM', 'POWERFUL_SHOUT'].includes(currentAction)) {
            console.log(` DominantRoarFace should be active for: ${currentAction}`);
        }
    }, 1000);
}

// Test DominantRoarFace preset
function testDominantRoarFace() {
    const vrm = window.currentVrm;
    if (!vrm) {
        console.error(' VRM not found. Make sure the app is running and VRM is loaded.');
        return;
    }

    const controller = window.mainCharacterController;
    if (!controller) {
        console.error(' MainCharacterController not found globally.');
        return;
    }

    console.log(' Testing DominantRoarFace preset...');

    // Test 1: Basic DominantRoarFace
    console.log(' Test 1: Basic DominantRoarFace');
    controller.activateDominantRoarFace(1.0);

    // Test 2: Dynamic DominantRoarFace after 2 seconds
    setTimeout(() => {
        console.log(' Test 2: Dynamic DominantRoarFace');
        controller.activateDominantRoarFaceDynamic();
    }, 2000);

    // Test 3: Reset after 4 seconds
    setTimeout(() => {
        console.log(' Test 3: Reset expressions');
        const expManager = vrm.expressionManager;
        if (expManager) {
            const allExpressions = ['happy', 'angry', 'sad', 'relaxed', 'surprised', 'neutral', 'blink', 'aa', 'ih', 'oh', 'ou', 'tongue_out', 'tongueOut', 'blush'];
            allExpressions.forEach(exp => expManager.setValue(exp, 0.0));
        }
    }, 4000);

    console.log(' DominantRoarFace tests scheduled. Check for intense dominant, commanding expression.');
}

// Test all presets in sequence
function testAllPresets() {
    console.log(' Starting comprehensive preset test sequence...');
    
    testFocusedTeaseFace();
    
    setTimeout(() => {
        testDramaticOpenMouthFace();
    }, 5000);
    
    setTimeout(() => {
        testOverwhelmedFace();
    }, 9000);
    
    setTimeout(() => {
        testSoftBreathFace();
    }, 13000);
    
    setTimeout(() => {
        testDominantRoarFace();
    }, 17000);
    
    console.log(' All preset tests scheduled. Each will run for 4 seconds with 1 second gaps.');
}

console.log(' Complete Expression Preset Test Suite Loaded!');
console.log('');
console.log('Available test functions:');
console.log('testFocusedTeaseFace() - Test intense focused/teasing expression');
console.log('testDramaticOpenMouthFace() - Test dramatic open-mouth expression');
console.log('testOverwhelmedFace() - Test intense strained expression');
console.log('testSoftBreathFace() - Test flushed vulnerable expression');
console.log('testDominantRoarFace() - Test dominant commanding expression');
console.log('testAllPresets() - Test all presets in sequence');
console.log('monitorAllAnimations() - Monitor automatic activation');
console.log('');
console.log(' Key Differences Between Presets:');
console.log('PleasureFace → balanced + relaxed');
console.log('WildExcitedFace → intense + wide mouth');
console.log('OverwhelmedFace → tense + strained');
console.log('SoftBreathFace → flushed + vulnerable');
console.log('FocusedTeaseFace → dominant + focused');
console.log('DramaticOpenMouthFace → dramatic + shouting');
console.log('DominantRoarFace → commanding + battle scream');
