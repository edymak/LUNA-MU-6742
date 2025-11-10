/**
 * LUNA MU 6742 - Production Interface Script
 * (Modified: centralized conditional processing)
 *
 * Fairchild 670 + Neve 542/Studer A827 Emulation
 *
 * NOTE: Centralized system ensures "never process what isn't heard".
 */

Content.makeFrontInterface(1500, 600);

Console.print("LUNA MU 6742 - INTERFACE LOADING...");

// ==================== GLOBAL VARIABLES ====================
var currentSkin = 0;
var clickCount = 0;
var lastClickTime = 0;
var buttonPressed = false;
var colorStateL = 0;
var colorStateR = 0;

// VU meter smoothing (ballistics) - START AT REST POSITION
reg vuSmoothL = 0;   // Frame 0 = -20 (rest when plugin off)
reg vuSmoothR = 0;
reg vuSmoothMid = 0;
reg vuSmoothSide = 0;

// Tape meter smoothing
reg driveSmoothL = 0;
reg driveSmoothR = 0;
reg levelSmoothL = 0;
reg levelSmoothR = 0;

// ==================== INITIALIZE GLOBALS ====================
Globals.CompIn = 1;
Globals.TapeBypass = 0;
Globals.TapeInL = 1;
Globals.TapeInR = 1;
Globals.IsStuderMode = 0;
Globals.InputGainL = 10;
Globals.InputGainR = 10;
Globals.InputGainMid = 10;
Globals.InputGainSide = 10;
Globals.ThresholdL = 5;
Globals.ThresholdR = 5;
Globals.ThresholdMid = 5;
Globals.ThresholdSide = 5;
Globals.TimeConstantL = 2;
Globals.TimeConstantR = 2;
Globals.TimeConstantMid = 2;
Globals.TimeConstantSide = 2;
Globals.OutputL = 50;
Globals.OutputR = 50;
Globals.OutputMid = 50;
Globals.OutputSide = 50;
Globals.MixKnob = 100;
Globals.SCHPFSwitchL = 0;
Globals.SCHPFSwitchR = 0;
Globals.SCHPFSwitchMid = 0;
Globals.SCHPFSwitchSide = 0;
Globals.MidSideMode = 1;
Globals.CompTapeOrder = 0;
Globals.TrimL = 0;
Globals.TrimR = 0;
Globals.SaturationL = 0;
Globals.SaturationR = 0;
Globals.BlendL = 100;
Globals.BlendR = 100;
Globals.TextureL = 0;
Globals.TextureR = 0;
Globals.IPSL = 1;
Globals.IPSR = 1;
Globals.ColorModeL = 0;
Globals.ColorModeR = 0;
Globals.grL = 0;
Globals.grR = 0;
Globals.vuNeedleL = 0;
Globals.vuNeedleR = 0;
Globals.driveOutL = 0;
Globals.driveOutR = 0;
Globals.levelOutL = 0;
Globals.levelOutR = 0;
Globals.compGRL = 0;
Globals.compGRR = 0;
Globals.tapeDrivePeakL = 0;
Globals.tapeDrivePeakR = 0;
Globals.tapeLevelPeakL = 0;
Globals.tapeLevelPeakR = 0;

// ==================== CENTRALIZED ACTIVE FLAGS ====================
// These are updated by updateActiveStates() and used everywhere
var compActive = true;    // true when compressor is enabled (CompIn == 1)
var tapeActive = true;    // true when tape is active (TapeBypass == 0)
var linkActive = false;
var tapeInLActive = true;
var tapeInRActive = true;

// ==================== COMPONENT REFERENCES ====================
// Skin switching
const var NuMoonLogo = Content.getComponent("NuMoonLogo");
const var FaceplateNormal = Content.getComponent("FaceplateNormal");
const var FaceplateAlt = Content.getComponent("FaceplateAlt");
const var FaceplatePurple = Content.getComponent("FaceplatePurple");

// Tubes
const var TubeGlowOff = Content.getComponent("TubeGlowOff");
const var TubeGlowOn = Content.getComponent("TubeGlowOn");

// Bypass buttons
const var CompOffButton = Content.getComponent("CompOffButton");
const var TapeOffButton = Content.getComponent("TapeOffButton");

// Compressor L/R
const var InputGainL = Content.getComponent("InputGainL");
const var InputGainR = Content.getComponent("InputGainR");
const var ThresholdL = Content.getComponent("ThresholdL");
const var ThresholdR = Content.getComponent("ThresholdR");
const var TimeConstantL = Content.getComponent("TimeConstantL");
const var TimeConstantR = Content.getComponent("TimeConstantR");
const var OutputL = Content.getComponent("OutputL");
const var OutputR = Content.getComponent("OutputR");
const var SCHPFSwitchL = Content.getComponent("SCHPFSwitchL");
const var SCHPFSwitchR = Content.getComponent("SCHPFSwitchR");

// Compressor Mid/Side
const var InputGainMid = Content.getComponent("InputGainMid");
const var InputGainSide = Content.getComponent("InputGainSide");
const var ThresholdMid = Content.getComponent("ThresholdMid");
const var ThresholdSide = Content.getComponent("ThresholdSide");
const var TimeConstantMid = Content.getComponent("TimeConstantMid");
const var TimeConstantSide = Content.getComponent("TimeConstantSide");
const var OutputMid = Content.getComponent("OutputMid");
const var OutputSide = Content.getComponent("OutputSide");
const var SCHPFSwitchMid = Content.getComponent("SCHPFSwitchMid");
const var SCHPFSwitchSide = Content.getComponent("SCHPFSwitchSide");

// Compressor global
const var MixKnob = Content.getComponent("MixKnob");
const var LinkSwitch = Content.getComponent("LinkSwitch");
const var MidSideSwitch = Content.getComponent("MidSideSwitch");
const var CompTapeOrderSwitch = Content.getComponent("CompTapeOrderSwitch");

// Tape L/R
const var TrimL = Content.getComponent("TrimL");
const var TrimR = Content.getComponent("TrimR");
const var SaturationL = Content.getComponent("SaturationL");
const var SaturationR = Content.getComponent("SaturationR");
const var BlendL = Content.getComponent("BlendL");
const var BlendR = Content.getComponent("BlendR");
const var TextureL = Content.getComponent("TextureL");
const var TextureR = Content.getComponent("TextureR");
const var IPSSwitchL = Content.getComponent("IPSSwitchL");
const var IPSSwitchR = Content.getComponent("IPSSwitchR");
const var ColorModeLButton = Content.getComponent("ColorModeLButton");
const var ColorModeRButton = Content.getComponent("ColorModeRButton");

// Color Mode images
const var ColorModeLOff = Content.getComponent("ColorModeLOff");
const var ColorModeLOrange = Content.getComponent("ColorModeLOrange");
const var ColorModeLBlue = Content.getComponent("ColorModeLBlue");
const var ColorModeROff = Content.getComponent("ColorModeROff");
const var ColorModeROrange = Content.getComponent("ColorModeROrange");
const var ColorModeRBlue = Content.getComponent("ColorModeRBlue");
const var TapeInL = Content.getComponent("TapeInL");
const var TapeInR = Content.getComponent("TapeInR");

// Meters
const var VUMeterLeft = Content.getComponent("VUMeterLeft");
const var VUMeterRight = Content.getComponent("VUMeterRight");
const var VUMeterMid = Content.getComponent("VUMeterMid");
const var VUMeterSide = Content.getComponent("VUMeterSide");
const var DriveMeterL = Content.getComponent("DriveMeterL");
const var DriveMeterR = Content.getComponent("DriveMeterR");
const var LevelMeterL = Content.getComponent("LevelMeterL");
const var LevelMeterR = Content.getComponent("LevelMeterR");

// ==================== FIXED METER MAPPING ====================
inline function mapDriveMeter(drivePeak)
{
    local step = drivePeak * 9.0;
    return Math.max(0, Math.min(8, Math.round(step)));
}

inline function mapLevelMeter(outputPeak)
{
    local dB = (outputPeak > 0.0001) ? 20.0 * Math.log10(outputPeak) + 23.25 : -60.0;
    
    if (dB < -10) return 0;
    else if (dB < -2) return 1;
    else if (dB < 4) return 2;
    else if (dB < 10) return 3;
    else if (dB < 14) return 4;
    else if (dB < 18) return 5;
    else if (dB < 20) return 6;
    else if (dB < 22) return 7;
    else return 8;
}

// ==================== CENTRALIZED STATE UPDATER ====================
inline function updateActiveStates()
{
    // Update boolean flags from Globals / UI
    compActive = (Globals.CompIn > 0.5);
    tapeActive = (Globals.TapeBypass < 0.5);
    linkActive = (LinkSwitch ? LinkSwitch.getValue() == 1 : false);
    tapeInLActive = (Globals.TapeInL > 0.5);
    tapeInRActive = (Globals.TapeInR > 0.5);
}

// ==================== TUBE GLOW ANIMATION (uses flags) ====================
inline function updateTubeGlow()
{
    // skip if tube component absent or compressor not active
    if (!TubeGlowOn || !compActive) {
        if (TubeGlowOn) TubeGlowOn.set("alpha", 0.0);
        return;
    }
    
    local inputL = (Globals.MidSideMode == 0) ? 
        (InputGainMid ? InputGainMid.getValue() : 9.0) : 
        (InputGainL ? InputGainL.getValue() : 9.0);
    
    local inputR = (Globals.MidSideMode == 0) ? 
        (InputGainSide ? InputGainSide.getValue() : 9.0) : 
        (InputGainR ? InputGainR.getValue() : 9.0);
    
    local avgInput = (inputL + inputR) * 0.5;
    local baseBrightness = avgInput / 9.0;
    local avgGR = (Globals.compGRL + Globals.compGRR) * 0.5;
    
    local flicker = 1.0;
    if (avgGR > 0.05) {
        flicker = 0.97 + Math.random() * 0.04;
    }
    
    local finalGlow = Math.min(1.0, (baseBrightness * 0.7 + avgGR * 0.3) * flicker);
    TubeGlowOn.set("alpha", finalGlow);
}

// ==================== FIXED VU + LED METER UPDATE (uses flags) ====================
inline function updateMeters()
{
    // if both inactive, decay meters and return early
    if (!compActive && !tapeActive) {
        vuSmoothL *= 0.9; vuSmoothR *= 0.9; vuSmoothMid *= 0.9; vuSmoothSide *= 0.9;
        driveSmoothL *= 0.9; driveSmoothR *= 0.9; levelSmoothL *= 0.9; levelSmoothR *= 0.9;
        return;
    }
    
    local grLVal = (typeof Globals.compGRL !== 'undefined') ? Globals.compGRL : 0.0;
    local grRVal = (typeof Globals.compGRR !== 'undefined') ? Globals.compGRR : 0.0;
    local drivePeakLVal = (typeof Globals.tapeDrivePeakL !== 'undefined') ? Globals.tapeDrivePeakL : 0.0;
    local drivePeakRVal = (typeof Globals.tapeDrivePeakR !== 'undefined') ? Globals.tapeDrivePeakR : 0.0;
    local levelPeakLVal = (typeof Globals.tapeLevelPeakL !== 'undefined') ? Globals.tapeLevelPeakL : 0.0;
    local levelPeakRVal = (typeof Globals.tapeLevelPeakR !== 'undefined') ? Globals.tapeLevelPeakR : 0.0;
    
    // VU logic: only meaningful when compActive
    local vuStepL = 0.0;
    local vuStepR = 0.0;
    if (compActive) {
        if (grLVal < 0.01) vuStepL = 55.0; else vuStepL = 55.0 - (grLVal * 55.0);
        if (grRVal < 0.01) vuStepR = 55.0; else vuStepR = 55.0 - (grRVal * 55.0);
    } else {
        vuStepL = 0.0; vuStepR = 0.0;
    }
    
    // Drive and level meters (tape-related) only change when tapeActive
    local driveStepL = tapeActive ? mapDriveMeter(drivePeakLVal) : 0;
    local driveStepR = tapeActive ? mapDriveMeter(drivePeakRVal) : 0;
    local levelStepL = tapeActive ? mapLevelMeter(levelPeakLVal) : 0;
    local levelStepR = tapeActive ? mapLevelMeter(levelPeakRVal) : 0;
    
    vuSmoothL = vuSmoothL * 0.85 + vuStepL * 0.15;
    vuSmoothR = vuSmoothR * 0.85 + vuStepR * 0.15;
    driveSmoothL = driveSmoothL * 0.5 + driveStepL * 0.5;
    driveSmoothR = driveSmoothR * 0.5 + driveStepR * 0.5;
    levelSmoothL = levelSmoothL * 0.7 + levelStepL * 0.3;
    levelSmoothR = levelSmoothR * 0.7 + levelStepR * 0.3;
    
    // Update meters based on Mid/Side mode
    if (Globals.MidSideMode == 0) {
        if (VUMeterMid) VUMeterMid.setValue(Math.round(vuSmoothL));
        if (VUMeterSide) VUMeterSide.setValue(Math.round(vuSmoothR));
    } else {
        if (VUMeterLeft) VUMeterLeft.setValue(Math.round(vuSmoothL));
        if (VUMeterRight) VUMeterRight.setValue(Math.round(vuSmoothR));
    }
    
    if (DriveMeterL) DriveMeterL.setValue(Math.round(driveSmoothL));
    if (DriveMeterR) DriveMeterR.setValue(Math.round(driveSmoothR));
    if (LevelMeterL) LevelMeterL.setValue(Math.round(levelSmoothL));
    if (LevelMeterR) LevelMeterR.setValue(Math.round(levelSmoothR));
}

// ==================== SKIN SWITCHING ====================
inline function onNuMoonLogoControl(component, value)
{
    if (value == 0) {
        buttonPressed = false;
        return;
    }
    
    if (buttonPressed) return;
    buttonPressed = true;
    
    local currentTime = Engine.getUptime();
    
    if (currentTime - lastClickTime > 2.0) {
        clickCount = 0;
    }
    
    clickCount++;
    lastClickTime = currentTime;
    
    if (clickCount >= 5) {
        currentSkin = 2;
        if (FaceplateNormal) FaceplateNormal.set("visible", false);
        if (FaceplateAlt) FaceplateAlt.set("visible", false);
        if (FaceplatePurple) FaceplatePurple.set("visible", true);
        Globals.IsStuderMode = 1;
        clickCount = 0;
    } else {
        currentSkin = (currentSkin + 1) % 2;
        if (FaceplateNormal) FaceplateNormal.set("visible", currentSkin == 0);
        if (FaceplateAlt) FaceplateAlt.set("visible", currentSkin == 1);
        if (FaceplatePurple) FaceplatePurple.set("visible", false);
        Globals.IsStuderMode = 0;
    }
}

// ==================== BYPASS BUTTONS ====================
inline function onCompOffButtonControl(component, value)
{
    // keep UI behavior, update global and active flags centrally
    Globals.CompIn = value > 0.5 ? 0 : 1;
    updateActiveStates(); // immediate update so UI and timer reflect change
}

inline function onTapeOffButtonControl(component, value)
{
    Globals.TapeBypass = value;
    updateActiveStates(); // immediate update
}

// ==================== COMPRESSOR L/R CALLBACKS ====================
// NOTE: callbacks keep updating Globals and linked controls, but they do NOT run heavy processing.
// heavy processing/meter/tube updates are centralized in the timer.
inline function onInputGainLControl(component, value)
{
    Globals.InputGainL = value;
    if (LinkSwitch && LinkSwitch.getValue() == 1) {
        if (InputGainR) InputGainR.setValue(value);
        Globals.InputGainR = value;
    }
}

inline function onInputGainRControl(component, value)
{
    Globals.InputGainR = value;
    if (LinkSwitch && LinkSwitch.getValue() == 1) {
        if (InputGainL) InputGainL.setValue(value);
        Globals.InputGainL = value;
    }
}

inline function onThresholdLControl(component, value)
{
    Globals.ThresholdL = value;
    if (LinkSwitch && LinkSwitch.getValue() == 1) {
        if (ThresholdR) ThresholdR.setValue(value);
        Globals.ThresholdR = value;
    }
}

inline function onThresholdRControl(component, value)
{
    Globals.ThresholdR = value;
    if (LinkSwitch && LinkSwitch.getValue() == 1) {
        if (ThresholdL) ThresholdL.setValue(value);
        Globals.ThresholdL = value;
    }
}

inline function onTimeConstantLControl(component, value)
{
    Globals.TimeConstantL = value;
    if (LinkSwitch && LinkSwitch.getValue() == 1) {
        if (TimeConstantR) TimeConstantR.setValue(value);
        Globals.TimeConstantR = value;
    }
}

inline function onTimeConstantRControl(component, value)
{
    Globals.TimeConstantR = value;
    if (LinkSwitch && LinkSwitch.getValue() == 1) {
        if (TimeConstantL) TimeConstantL.setValue(value);
        Globals.TimeConstantL = value;
    }
}

inline function onOutputLControl(component, value)
{
    Globals.OutputL = value;
    if (LinkSwitch && LinkSwitch.getValue() == 1) {
        if (OutputR) OutputR.setValue(value);
        Globals.OutputR = value;
    }
}

inline function onOutputRControl(component, value)
{
    Globals.OutputR = value;
    if (LinkSwitch && LinkSwitch.getValue() == 1) {
        if (OutputL) OutputL.setValue(value);
        Globals.OutputL = value;
    }
}

inline function onSCHPFSwitchLControl(component, value)
{
    Globals.SCHPFSwitchL = value;
    if (LinkSwitch && LinkSwitch.getValue() == 1) {
        if (SCHPFSwitchR) SCHPFSwitchR.setValue(value);
        Globals.SCHPFSwitchR = value;
    }
}

inline function onSCHPFSwitchRControl(component, value)
{
    Globals.SCHPFSwitchR = value;
    if (LinkSwitch && LinkSwitch.getValue() == 1) {
        if (SCHPFSwitchL) SCHPFSwitchL.setValue(value);
        Globals.SCHPFSwitchL = value;
    }
}

// ==================== COMPRESSOR MID/SIDE CALLBACKS ====================
inline function onInputGainMidControl(component, value)
{
    Globals.InputGainMid = value;
    if (LinkSwitch && LinkSwitch.getValue() == 1) {
        if (InputGainSide) InputGainSide.setValue(value);
        Globals.InputGainSide = value;
    }
}

inline function onInputGainSideControl(component, value)
{
    Globals.InputGainSide = value;
    if (LinkSwitch && LinkSwitch.getValue() == 1) {
        if (InputGainMid) InputGainMid.setValue(value);
        Globals.InputGainMid = value;
    }
}

inline function onThresholdMidControl(component, value)
{
    Globals.ThresholdMid = value;
    if (LinkSwitch && LinkSwitch.getValue() == 1) {
        if (ThresholdSide) ThresholdSide.setValue(value);
        Globals.ThresholdSide = value;
    }
}

inline function onThresholdSideControl(component, value)
{
    Globals.ThresholdSide = value;
    if (LinkSwitch && LinkSwitch.getValue() == 1) {
        if (ThresholdMid) ThresholdMid.setValue(value);
        Globals.ThresholdMid = value;
    }
}

inline function onTimeConstantMidControl(component, value)
{
    Globals.TimeConstantMid = value;
    if (LinkSwitch && LinkSwitch.getValue() == 1) {
        if (TimeConstantSide) TimeConstantSide.setValue(value);
        Globals.TimeConstantSide = value;
    }
}

inline function onTimeConstantSideControl(component, value)
{
    Globals.TimeConstantSide = value;
    if (LinkSwitch && LinkSwitch.getValue() == 1) {
        if (TimeConstantMid) TimeConstantMid.setValue(value);
        Globals.TimeConstantMid = value;
    }
}

inline function onOutputMidControl(component, value)
{
    Globals.OutputMid = value;
    if (LinkSwitch && LinkSwitch.getValue() == 1) {
        if (OutputSide) OutputSide.setValue(value);
        Globals.OutputSide = value;
    }
}

inline function onOutputSideControl(component, value)
{
    Globals.OutputSide = value;
    if (LinkSwitch && LinkSwitch.getValue() == 1) {
        if (OutputMid) OutputMid.setValue(value);
        Globals.OutputMid = value;
    }
}

inline function onSCHPFSwitchMidControl(component, value)
{
    Globals.SCHPFSwitchMid = value;
    if (LinkSwitch && LinkSwitch.getValue() == 1) {
        if (SCHPFSwitchSide) SCHPFSwitchSide.setValue(value);
        Globals.SCHPFSwitchSide = value;
    }
}

inline function onSCHPFSwitchSideControl(component, value)
{
    Globals.SCHPFSwitchSide = value;
    if (LinkSwitch && LinkSwitch.getValue() == 1) {
        if (SCHPFSwitchMid) SCHPFSwitchMid.setValue(value);
        Globals.SCHPFSwitchMid = value;
    }
}

// ==================== COMPRESSOR GLOBAL CALLBACKS ====================
inline function onMixKnobControl(component, value)
{
    Globals.MixKnob = value;
}

inline function onLinkSwitchControl(component, value)
{
    // update linkActive immediately
    updateActiveStates();
}

// ==================== FIXED MID/SIDE SWITCH (REVERSED) ====================
inline function onMidSideSwitchControl(component, value)
{
    Globals.MidSideMode = value;
    
    // UI mapping stays as-is; no heavy DSP here
    if (value == 1) {
        // L/R MODE (switch UP)
        if (InputGainMid && InputGainL) {
            local midValue = InputGainMid.getValue();
            InputGainL.setValue(midValue);
            Globals.InputGainL = midValue;
        }
        if (InputGainSide && InputGainR) {
            local sideValue = InputGainSide.getValue();
            InputGainR.setValue(sideValue);
            Globals.InputGainR = sideValue;
        }
        if (ThresholdMid && ThresholdL) {
            local midValue = ThresholdMid.getValue();
            ThresholdL.setValue(midValue);
            Globals.ThresholdL = midValue;
        }
        if (ThresholdSide && ThresholdR) {
            local sideValue = ThresholdSide.getValue();
            ThresholdR.setValue(sideValue);
            Globals.ThresholdR = sideValue;
        }
        if (TimeConstantMid && TimeConstantL) {
            local midValue = TimeConstantMid.getValue();
            TimeConstantL.setValue(midValue);
            Globals.TimeConstantL = midValue;
        }
        if (TimeConstantSide && TimeConstantR) {
            local sideValue = TimeConstantSide.getValue();
            TimeConstantR.setValue(sideValue);
            Globals.TimeConstantR = sideValue;
        }
        if (OutputMid && OutputL) {
            local midValue = OutputMid.getValue();
            OutputL.setValue(midValue);
            Globals.OutputL = midValue;
        }
        if (OutputSide && OutputR) {
            local sideValue = OutputSide.getValue();
            OutputR.setValue(sideValue);
            Globals.OutputR = sideValue;
        }
        if (SCHPFSwitchMid && SCHPFSwitchL) {
            local midValue = SCHPFSwitchMid.getValue();
            SCHPFSwitchL.setValue(midValue);
            Globals.SCHPFSwitchL = midValue;
        }
        if (SCHPFSwitchSide && SCHPFSwitchR) {
            local sideValue = SCHPFSwitchSide.getValue();
            SCHPFSwitchR.setValue(sideValue);
            Globals.SCHPFSwitchR = sideValue;
        }
        
        if (InputGainL) InputGainL.set("visible", true);
        if (InputGainR) InputGainR.set("visible", true);
        if (ThresholdL) ThresholdL.set("visible", true);
        if (ThresholdR) ThresholdR.set("visible", true);
        if (TimeConstantL) TimeConstantL.set("visible", true);
        if (TimeConstantR) TimeConstantR.set("visible", true);
        if (OutputL) OutputL.set("visible", true);
        if (OutputR) OutputR.set("visible", true);
        if (SCHPFSwitchL) SCHPFSwitchL.set("visible", true);
        if (SCHPFSwitchR) SCHPFSwitchR.set("visible", true);
        if (VUMeterLeft) VUMeterLeft.set("visible", true);
        if (VUMeterRight) VUMeterRight.set("visible", true);
        
        if (InputGainMid) InputGainMid.set("visible", false);
        if (InputGainSide) InputGainSide.set("visible", false);
        if (ThresholdMid) ThresholdMid.set("visible", false);
        if (ThresholdSide) ThresholdSide.set("visible", false);
        if (TimeConstantMid) TimeConstantMid.set("visible", false);
        if (TimeConstantSide) TimeConstantSide.set("visible", false);
        if (OutputMid) OutputMid.set("visible", false);
        if (OutputSide) OutputSide.set("visible", false);
        if (SCHPFSwitchMid) SCHPFSwitchMid.set("visible", false);
        if (SCHPFSwitchSide) SCHPFSwitchSide.set("visible", false);
        if (VUMeterMid) VUMeterMid.set("visible", false);
        if (VUMeterSide) VUMeterSide.set("visible", false);
        
    } else {
        // M/S MODE (switch DOWN)
        if (InputGainL && InputGainMid) {
            local leftValue = InputGainL.getValue();
            InputGainMid.setValue(leftValue);
            Globals.InputGainMid = leftValue;
        }
        if (InputGainR && InputGainSide) {
            local rightValue = InputGainR.getValue();
            InputGainSide.setValue(rightValue);
            Globals.InputGainSide = rightValue;
        }
        if (ThresholdL && ThresholdMid) {
            local leftValue = ThresholdL.getValue();
            ThresholdMid.setValue(leftValue);
            Globals.ThresholdMid = leftValue;
        }
        if (ThresholdR && ThresholdSide) {
            local rightValue = ThresholdR.getValue();
            ThresholdSide.setValue(rightValue);
            Globals.ThresholdSide = rightValue;
        }
        if (TimeConstantL && TimeConstantMid) {
            local leftValue = TimeConstantL.getValue();
            TimeConstantMid.setValue(leftValue);
            Globals.TimeConstantMid = leftValue;
        }
        if (TimeConstantR && TimeConstantSide) {
            local rightValue = TimeConstantR.getValue();
            TimeConstantSide.setValue(rightValue);
            Globals.TimeConstantSide = rightValue;
        }
        if (OutputL && OutputMid) {
            local leftValue = OutputL.getValue();
            OutputMid.setValue(leftValue);
            Globals.OutputMid = leftValue;
        }
        if (OutputR && OutputSide) {
            local rightValue = OutputR.getValue();
            OutputSide.setValue(rightValue);
            Globals.OutputSide = rightValue;
        }
        if (SCHPFSwitchL && SCHPFSwitchMid) {
            local leftValue = SCHPFSwitchL.getValue();
            SCHPFSwitchMid.setValue(leftValue);
            Globals.SCHPFSwitchMid = leftValue;
        }
        if (SCHPFSwitchR && SCHPFSwitchSide) {
            local rightValue = SCHPFSwitchR.getValue();
            SCHPFSwitchSide.setValue(rightValue);
            Globals.SCHPFSwitchSide = rightValue;
        }
        
        if (InputGainL) InputGainL.set("visible", false);
        if (InputGainR) InputGainR.set("visible", false);
        if (ThresholdL) ThresholdL.set("visible", false);
        if (ThresholdR) ThresholdR.set("visible", false);
        if (TimeConstantL) TimeConstantL.set("visible", false);
        if (TimeConstantR) TimeConstantR.set("visible", false);
        if (OutputL) OutputL.set("visible", false);
        if (OutputR) OutputR.set("visible", false);
        if (SCHPFSwitchL) SCHPFSwitchL.set("visible", false);
        if (SCHPFSwitchR) SCHPFSwitchR.set("visible", false);
        if (VUMeterLeft) VUMeterLeft.set("visible", false);
        if (VUMeterRight) VUMeterRight.set("visible", false);
        
        if (InputGainMid) InputGainMid.set("visible", true);
        if (InputGainSide) InputGainSide.set("visible", true);
        if (ThresholdMid) ThresholdMid.set("visible", true);
        if (ThresholdSide) ThresholdSide.set("visible", true);
        if (TimeConstantMid) TimeConstantMid.set("visible", true);
        if (TimeConstantSide) TimeConstantSide.set("visible", true);
        if (OutputMid) OutputMid.set("visible", true);
        if (OutputSide) OutputSide.set("visible", true);
        if (SCHPFSwitchMid) SCHPFSwitchMid.set("visible", true);
        if (SCHPFSwitchSide) SCHPFSwitchSide.set("visible", true);
        if (VUMeterMid) VUMeterMid.set("visible", true);
        if (VUMeterSide) VUMeterSide.set("visible", true);
    }
}

inline function onCompTapeOrderSwitchControl(component, value)
{
    // Reverse the switch: up = comp→tape (0), down = tape→comp (1)
    Globals.CompTapeOrder = (value > 0.5) ? 0 : 1;
}

// ==================== TAPE CALLBACKS ====================
// keep UI updates; processing remains centralized
inline function onTrimLControl(component, value)
{
    Globals.TrimL = value;
    if (LinkSwitch && LinkSwitch.getValue() == 1) {
        if (TrimR) TrimR.setValue(value);
        Globals.TrimR = value;
    }
}

inline function onTrimRControl(component, value)
{
    Globals.TrimR = value;
    if (LinkSwitch && LinkSwitch.getValue() == 1) {
        if (TrimL) TrimL.setValue(value);
        Globals.TrimL = value;
    }
}

inline function onSaturationLControl(component, value)
{
    Globals.SaturationL = value;
    if (LinkSwitch && LinkSwitch.getValue() == 1) {
        if (SaturationR) SaturationR.setValue(value);
        Globals.SaturationR = value;
    }
}

inline function onSaturationRControl(component, value)
{
    Globals.SaturationR = value;
    if (LinkSwitch && LinkSwitch.getValue() == 1) {
        if (SaturationL) SaturationL.setValue(value);
        Globals.SaturationL = value;
    }
}

inline function onBlendLControl(component, value)
{
    Globals.BlendL = value;
    if (LinkSwitch && LinkSwitch.getValue() == 1) {
        if (BlendR) BlendR.setValue(value);
        Globals.BlendR = value;
    }
}

inline function onBlendRControl(component, value)
{
    Globals.BlendR = value;
    if (LinkSwitch && LinkSwitch.getValue() == 1) {
        if (BlendL) BlendL.setValue(value);
        Globals.BlendL = value;
    }
}

inline function onTextureLControl(component, value)
{
    Globals.TextureL = value;
    if (LinkSwitch && LinkSwitch.getValue() == 1) {
        if (TextureR) TextureR.setValue(value);
        Globals.TextureR = value;
    }
}

inline function onTextureRControl(component, value)
{
    Globals.TextureR = value;
    if (LinkSwitch && LinkSwitch.getValue() == 1) {
        if (TextureL) TextureL.setValue(value);
        Globals.TextureL = value;
    }
}

inline function onIPSSwitchLControl(component, value)
{
    Globals.IPSL = value;
    if (LinkSwitch && LinkSwitch.getValue() == 1) {
        if (IPSSwitchR) IPSSwitchR.setValue(value);
        Globals.IPSR = value;
    }
}

inline function onIPSSwitchRControl(component, value)
{
    Globals.IPSR = value;
    if (LinkSwitch && LinkSwitch.getValue() == 1) {
        if (IPSSwitchL) IPSSwitchL.setValue(value);
        Globals.IPSL = value;
    }
}

inline function onTapeInLControl(component, value)
{
    Globals.TapeInL = value;
    updateActiveStates(); // reflect tape input change immediately
    if (LinkSwitch && LinkSwitch.getValue() == 1) {
        if (TapeInR) TapeInR.setValue(value);
        Globals.TapeInR = value;
    }
}

inline function onTapeInRControl(component, value)
{
    Globals.TapeInR = value;
    updateActiveStates();
    if (LinkSwitch && LinkSwitch.getValue() == 1) {
        if (TapeInL) TapeInL.setValue(value);
        Globals.TapeInL = value;
    }
}

// ==================== COLOR BUTTON ====================
inline function onColorModeLButtonControl(component, value)
{
    if (value == 0) return;
    
    // UI can still change colors while tape inactive; color toggles are purely visual.
    colorStateL = (colorStateL + 1) % 3;
    Globals.ColorModeL = colorStateL;
    
    if (ColorModeLOff) ColorModeLOff.set("visible", colorStateL == 0);
    if (ColorModeLOrange) ColorModeLOrange.set("visible", colorStateL == 1);
    if (ColorModeLBlue) ColorModeLBlue.set("visible", colorStateL == 2);
    
    if (LinkSwitch && LinkSwitch.getValue() == 1) {
        colorStateR = colorStateL;
        Globals.ColorModeR = colorStateL;
        if (ColorModeROff) ColorModeROff.set("visible", colorStateR == 0);
        if (ColorModeROrange) ColorModeROrange.set("visible", colorStateR == 1);
        if (ColorModeRBlue) ColorModeRBlue.set("visible", colorStateR == 2);
    }
}

inline function onColorModeRButtonControl(component, value)
{
    if (value == 0) return;
    
    colorStateR = (colorStateR + 1) % 3;
    Globals.ColorModeR = colorStateR;
    
    if (ColorModeROff) ColorModeROff.set("visible", colorStateR == 0);
    if (ColorModeROrange) ColorModeROrange.set("visible", colorStateR == 1);
    if (ColorModeRBlue) ColorModeRBlue.set("visible", colorStateR == 2);
    
    if (LinkSwitch && LinkSwitch.getValue() == 1) {
        colorStateL = colorStateR;
        Globals.ColorModeL = colorStateR;
        if (ColorModeLOff) ColorModeLOff.set("visible", colorStateL == 0);
        if (ColorModeLOrange) ColorModeLOrange.set("visible", colorStateL == 1);
        if (ColorModeLBlue) ColorModeLBlue.set("visible", colorStateL == 2);
    }
}

// ==================== SET ALL CALLBACKS ====================
if (NuMoonLogo) NuMoonLogo.setControlCallback(onNuMoonLogoControl);
if (CompOffButton) CompOffButton.setControlCallback(onCompOffButtonControl);
if (TapeOffButton) TapeOffButton.setControlCallback(onTapeOffButtonControl);

if (InputGainL) InputGainL.setControlCallback(onInputGainLControl);
if (InputGainR) InputGainR.setControlCallback(onInputGainRControl);
if (ThresholdL) ThresholdL.setControlCallback(onThresholdLControl);
if (ThresholdR) ThresholdR.setControlCallback(onThresholdRControl);
if (TimeConstantL) TimeConstantL.setControlCallback(onTimeConstantLControl);
if (TimeConstantR) TimeConstantR.setControlCallback(onTimeConstantRControl);
if (OutputL) OutputL.setControlCallback(onOutputLControl);
if (OutputR) OutputR.setControlCallback(onOutputRControl);
if (SCHPFSwitchL) SCHPFSwitchL.setControlCallback(onSCHPFSwitchLControl);
if (SCHPFSwitchR) SCHPFSwitchR.setControlCallback(onSCHPFSwitchRControl);

if (InputGainMid) InputGainMid.setControlCallback(onInputGainMidControl);
if (InputGainSide) InputGainSide.setControlCallback(onInputGainSideControl);
if (ThresholdMid) ThresholdMid.setControlCallback(onThresholdMidControl);
if (ThresholdSide) ThresholdSide.setControlCallback(onThresholdSideControl);
if (TimeConstantMid) TimeConstantMid.setControlCallback(onTimeConstantMidControl);
if (TimeConstantSide) TimeConstantSide.setControlCallback(onTimeConstantSideControl);
if (OutputMid) OutputMid.setControlCallback(onOutputMidControl);
if (OutputSide) OutputSide.setControlCallback(onOutputSideControl);
if (SCHPFSwitchMid) SCHPFSwitchMid.setControlCallback(onSCHPFSwitchMidControl);
if (SCHPFSwitchSide) SCHPFSwitchSide.setControlCallback(onSCHPFSwitchSideControl);

if (MixKnob) MixKnob.setControlCallback(onMixKnobControl);
if (LinkSwitch) LinkSwitch.setControlCallback(onLinkSwitchControl);
if (MidSideSwitch) MidSideSwitch.setControlCallback(onMidSideSwitchControl);
if (CompTapeOrderSwitch) CompTapeOrderSwitch.setControlCallback(onCompTapeOrderSwitchControl);

if (TrimL) TrimL.setControlCallback(onTrimLControl);
if (TrimR) TrimR.setControlCallback(onTrimRControl);
if (SaturationL) SaturationL.setControlCallback(onSaturationLControl);
if (SaturationR) SaturationR.setControlCallback(onSaturationRControl);
if (BlendL) BlendL.setControlCallback(onBlendLControl);
if (BlendR) BlendR.setControlCallback(onBlendRControl);
if (TextureL) TextureL.setControlCallback(onTextureLControl);
if (TextureR) TextureR.setControlCallback(onTextureRControl);
if (IPSSwitchL) IPSSwitchL.setControlCallback(onIPSSwitchLControl);
if (IPSSwitchR) IPSSwitchR.setControlCallback(onIPSSwitchRControl);
if (ColorModeLButton) ColorModeLButton.setControlCallback(onColorModeLButtonControl);
if (ColorModeRButton) ColorModeRButton.setControlCallback(onColorModeRButtonControl);
if (TapeInL) TapeInL.setControlCallback(onTapeInLControl);
if (TapeInR) TapeInR.setControlCallback(onTapeInRControl);

// ==================== CENTRALIZED UPDATE TIMER ====================
const var updateTimer = Engine.createTimerObject();
updateTimer.setTimerCallback(function()
{
    // refresh central flags
    updateActiveStates();
    
    // if both inactive, do minimal work (decay meters handled inside updateMeters)
    if (!compActive && !tapeActive) {
        updateMeters();
        return;
    }
    
    // call section-specific visuals/updates only when active
    if (compActive) updateTubeGlow();
    
    // meters handle both comp/tape internally depending on flags
    updateMeters();
});

// start timer at ~30Hz (same as your original 33ms)
updateTimer.startTimer(33);

// ==================== INITIALIZATION ====================
if (FaceplateNormal) FaceplateNormal.set("visible", true);
if (FaceplateAlt) FaceplateAlt.set("visible", false);
if (FaceplatePurple) FaceplatePurple.set("visible", false);
if (TubeGlowOn) TubeGlowOn.set("alpha", 0);

if (ColorModeLOff) ColorModeLOff.set("visible", true);
if (ColorModeLOrange) ColorModeLOrange.set("visible", false);
if (ColorModeLBlue) ColorModeLBlue.set("visible", false);
if (ColorModeROff) ColorModeROff.set("visible", true);
if (ColorModeROrange) ColorModeROrange.set("visible", false);
if (ColorModeRBlue) ColorModeRBlue.set("visible", false);

if (MidSideSwitch) MidSideSwitch.setValue(1);
if (CompTapeOrderSwitch) CompTapeOrderSwitch.setValue(0);
if (LinkSwitch) LinkSwitch.setValue(0);

// set visibility defaults
if (InputGainL) InputGainL.set("visible", true);
if (InputGainR) InputGainR.set("visible", true);
if (ThresholdL) ThresholdL.set("visible", true);
if (ThresholdR) ThresholdR.set("visible", true);
if (TimeConstantL) TimeConstantL.set("visible", true);
if (TimeConstantR) TimeConstantR.set("visible", true);
if (OutputL) OutputL.set("visible", true);
if (OutputR) OutputR.set("visible", true);
if (SCHPFSwitchL) SCHPFSwitchL.set("visible", true);
if (SCHPFSwitchR) SCHPFSwitchR.set("visible", true);
if (VUMeterLeft) VUMeterLeft.set("visible", true);
if (VUMeterRight) VUMeterRight.set("visible", true);

if (InputGainMid) InputGainMid.set("visible", false);
if (InputGainSide) InputGainSide.set("visible", false);
if (ThresholdMid) ThresholdMid.set("visible", false);
if (ThresholdSide) ThresholdSide.set("visible", false);
if (TimeConstantMid) TimeConstantMid.set("visible", false);
if (TimeConstantSide) TimeConstantSide.set("visible", false);
if (OutputMid) OutputMid.set("visible", false);
if (OutputSide) OutputSide.set("visible", false);
if (SCHPFSwitchMid) SCHPFSwitchMid.set("visible", false);
if (SCHPFSwitchSide) SCHPFSwitchSide.set("visible", false);
if (VUMeterMid) VUMeterMid.set("visible", false);
if (VUMeterSide) VUMeterSide.set("visible", false);

updateActiveStates(); // initial state

Console.print("✅ LUNA MU 6742 - INTERFACE LOADED (centralized conditional processing)");
Console.print("   ✅ Compressor active flag: " + (compActive ? "ON" : "OFF"));
Console.print("   ✅ Tape active flag: " + (tapeActive ? "ON" : "OFF"));
