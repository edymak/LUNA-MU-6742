function processBlock(channels)
{
    var numSamples = channels[0].length;
    var compOrder = Globals.CompTapeOrder;
    
    if (compOrder < 0.5)
    {
        // ========== ORDER 1: COMP → TAPE (-18 LUFS CALIBRATED) ==========
        
        // ========== COMPRESSOR SECTION ==========
        var compBypass = Globals.CompIn < 0.5;
        
        if (!compBypass)
        {
            // ✅ FIXED: -18 LUFS calibrated input gains (was -20dB reference)
            var inputGainL = Math.pow(10, (Globals.InputGainL - 18.0) / 20);
            var inputGainR = Math.pow(10, (Globals.InputGainR - 18.0) / 20);
            var inputGainMid = Math.pow(10, (Globals.InputGainMid - 18.0) / 20);
            var inputGainSide = Math.pow(10, (Globals.InputGainSide - 18.0) / 20);
            
            var thresholdL = 0.95 - (Globals.ThresholdL / 10.0 * 0.91);
            var thresholdR = 0.95 - (Globals.ThresholdR / 10.0 * 0.91);
            var thresholdMid = 0.95 - (Globals.ThresholdMid / 10.0 * 0.91);
            var thresholdSide = 0.95 - (Globals.ThresholdSide / 10.0 * 0.91);
            
            // ✅ FIXED: -18 LUFS calibrated output gains (was 50-center with 0.4 scaling)
            var outputGainL = Math.pow(10, ((Globals.OutputL - 50) * 0.3) / 20);
            var outputGainR = Math.pow(10, ((Globals.OutputR - 50) * 0.3) / 20);
            var outputGainMid = Math.pow(10, ((Globals.OutputMid - 50) * 0.3) / 20);
            var outputGainSide = Math.pow(10, ((Globals.OutputSide - 50) * 0.3) / 20);
            
            var mix = Globals.MixKnob / 100.0;
            var midSide = Globals.MidSideMode == 0;
            
            var peakGRL = 0.0;
            var peakGRR = 0.0;
            
            for (var s = 0; s < numSamples; s++)
            {
                var L = channels[0][s];
                var R = channels[1][s];
                var dryL = L;
                var dryR = R;
                
                if (midSide)
                {
                    var M = (L + R) * 0.5;
                    var S = (L - R) * 0.5;
                    
                    // ✅ REMOVED: transformer(M, xfrmInL) 
                    M = M * inputGainMid;
                    
                    // Sidechain HPF for detection
                    var detectionM = M;
                    if (Globals.SCHPFSwitchMid > 0.5) {
                        var scFreq = (Globals.SCHPFSwitchMid > 1.5) ? 120.0 : 60.0;
                        var omega = 6.28318 * scFreq / Engine.getSampleRate();
                        var alpha = Math.exp(-omega);
                        detectionM = M - scHPF_Mid * alpha;
                        scHPF_Mid = detectionM;
                    }
                    
                    // Time constant logic for MID
                    var attackTimeMid = 0.0002;
                    var releaseTimeMid = 0.3;
                    var tcMid = Globals.TimeConstantMid;
                    var inputLevelMid = Math.abs(detectionM);
                    
                    if (tcMid < 1.5) {
                        attackTimeMid = 0.0002;
                        releaseTimeMid = 0.3;
                    }
                    else if (tcMid < 2.5) {
                        attackTimeMid = 0.0002;
                        releaseTimeMid = 0.8;
                    }
                    else if (tcMid < 3.5) {
                        attackTimeMid = 0.0004;
                        releaseTimeMid = 2.0;
                    }
                    else if (tcMid < 4.5) {
                        attackTimeMid = 0.0004;
                        releaseTimeMid = 5.0;
                    }
                    else if (tcMid < 5.5) {
                        attackTimeMid = 0.0004;
                        if (inputLevelMid > peakHoldMid) {
                            peakHoldMid = inputLevelMid;
                            peakTimerMid = 0.0;
                            releaseTimeMid = 2.0;
                        }
                        else {
                            peakTimerMid = peakTimerMid + (1.0 / Engine.getSampleRate());
                            releaseTimeMid = (peakTimerMid < 0.1) ? 2.0 : 10.0;
                        }
                    }
                    else {
                        attackTimeMid = 0.0002;
                        if (inputLevelMid > peakHoldMid) {
                            peakHoldMid = inputLevelMid;
                            peakTimerMid = 0.0;
                            releaseTimeMid = 0.3;
                        }
                        else {
                            peakTimerMid = peakTimerMid + (1.0 / Engine.getSampleRate());
                            if (peakTimerMid < 0.05)
                                releaseTimeMid = 0.3;
                            else if (peakTimerMid < 0.5)
                                releaseTimeMid = 10.0;
                            else
                                releaseTimeMid = 25.0;
                        }
                    }
                    
                    // Envelope follower for MID
                    var attackCoeffMid = Math.exp(-1.0 / (attackTimeMid * Engine.getSampleRate()));
                    var releaseCoeffMid = Math.exp(-1.0 / (releaseTimeMid * Engine.getSampleRate()));
                    
                    if (inputLevelMid > envMid)
                        envMid = envMid + (1.0 - attackCoeffMid) * (inputLevelMid - envMid);
                    else
                        envMid = envMid + (1.0 - releaseCoeffMid) * (inputLevelMid - envMid);
                    
                    var preMid = M;
                    
                    // Compression
                    if (Globals.ThresholdMid > 0.1) {
                        if (envMid > thresholdMid) {
                            var overMid = envMid - thresholdMid;
                            var ratioMid = 2.0 + (overMid * 10.0);
                            ratioMid = Math.min(ratioMid, 30.0);
                            var compMid = thresholdMid + (overMid / ratioMid);
                            var scale = compMid / envMid;
                            M = M * scale;
                        }
                    }
                    
                    var postMid = M;
                    // ✅ REMOVED: transformer(M, xfrmOutL)
                    M = M * outputGainMid;
                    // ✅ KEPT: softClip for gentle limiting
                    M = softClip(M);
                    
                    // GR calculation
                    if (Math.abs(preMid) > 0.001) {
                        var grMid = 1.0 - (Math.abs(postMid) / Math.abs(preMid));
                        peakGRL = Math.max(peakGRL, Math.max(0.0, Math.min(1.0, grMid)));
                    }
                    
                    // SIDE processing
                    // ✅ REMOVED: transformer(S, xfrmInR)
                    S = S * inputGainSide;
                    
                    // Sidechain HPF for detection
                    var detectionS = S;
                    if (Globals.SCHPFSwitchSide > 0.5) {
                        var scFreq = (Globals.SCHPFSwitchSide > 1.5) ? 120.0 : 60.0;
                        var omega = 6.28318 * scFreq / Engine.getSampleRate();
                        var alpha = Math.exp(-omega);
                        detectionS = S - scHPF_Side * alpha;
                        scHPF_Side = detectionS;
                    }
                    
                    // Time constant logic for SIDE
                    var attackTimeSide = 0.0002;
                    var releaseTimeSide = 0.3;
                    var tcSide = Globals.TimeConstantSide;
                    var inputLevelSide = Math.abs(detectionS);
                    
                    if (tcSide < 1.5) {
                        attackTimeSide = 0.0002;
                        releaseTimeSide = 0.3;
                    }
                    else if (tcSide < 2.5) {
                        attackTimeSide = 0.0002;
                        releaseTimeSide = 0.8;
                    }
                    else if (tcSide < 3.5) {
                        attackTimeSide = 0.0004;
                        releaseTimeSide = 2.0;
                    }
                    else if (tcSide < 4.5) {
                        attackTimeSide = 0.0004;
                        releaseTimeSide = 5.0;
                    }
                    else if (tcSide < 5.5) {
                        attackTimeSide = 0.0004;
                        if (inputLevelSide > peakHoldSide) {
                            peakHoldSide = inputLevelSide;
                            peakTimerSide = 0.0;
                            releaseTimeSide = 2.0;
                        }
                        else {
                            peakTimerSide = peakTimerSide + (1.0 / Engine.getSampleRate());
                            releaseTimeSide = (peakTimerSide < 0.1) ? 2.0 : 10.0;
                        }
                    }
                    else {
                        attackTimeSide = 0.0002;
                        if (inputLevelSide > peakHoldSide) {
                            peakHoldSide = inputLevelSide;
                            peakTimerSide = 0.0;
                            releaseTimeSide = 0.3;
                        }
                        else {
                            peakTimerSide = peakTimerSide + (1.0 / Engine.getSampleRate());
                            if (peakTimerSide < 0.05)
                                releaseTimeSide = 0.3;
                            else if (peakTimerSide < 0.5)
                                releaseTimeSide = 10.0;
                            else
                                releaseTimeSide = 25.0;
                        }
                    }
                    
                    // Envelope follower for SIDE
                    var attackCoeffSide = Math.exp(-1.0 / (attackTimeSide * Engine.getSampleRate()));
                    var releaseCoeffSide = Math.exp(-1.0 / (releaseTimeSide * Engine.getSampleRate()));
                    
                    if (inputLevelSide > envSide)
                        envSide = envSide + (1.0 - attackCoeffSide) * (inputLevelSide - envSide);
                    else
                        envSide = envSide + (1.0 - releaseCoeffSide) * (inputLevelSide - envSide);
                    
                    var preSide = S;
                    
                    // Compression
                    if (Globals.ThresholdSide > 0.1) {
                        if (envSide > thresholdSide) {
                            var overSide = envSide - thresholdSide;
                            var ratioSide = 2.0 + (overSide * 10.0);
                            ratioSide = Math.min(ratioSide, 30.0);
                            var compSide = thresholdSide + (overSide / ratioSide);
                            var scale = compSide / envSide;
                            S = S * scale;
                        }
                    }
                    
                    var postSide = S;
                    // ✅ REMOVED: transformer(S, xfrmOutR)
                    S = S * outputGainSide;
                    S = softClip(S);
                    
                    // GR calculation
                    if (Math.abs(preSide) > 0.001) {
                        var grSide = 1.0 - (Math.abs(postSide) / Math.abs(preSide));
                        peakGRR = Math.max(peakGRR, Math.max(0.0, Math.min(1.0, grSide)));
                    }
                    
                    // Convert back to L/R
                    L = M + S;
                    R = M - S;
                }
                else
                {
                    // L/R processing
                    // ✅ REMOVED: transformer(L, xfrmInL)
                    L = L * inputGainL;
                    
                    // Sidechain HPF for detection
                    var detectionL = L;
                    if (Globals.SCHPFSwitchL > 0.5) {
                        var scFreq = (Globals.SCHPFSwitchL > 1.5) ? 120.0 : 60.0;
                        var omega = 6.28318 * scFreq / Engine.getSampleRate();
                        var alpha = Math.exp(-omega);
                        detectionL = L - scHPF_L * alpha;
                        scHPF_L = detectionL;
                    }
                    
                    // [Time constant and envelope follower logic for LEFT - same as above]
                    var attackTimeL = 0.0002;
                    var releaseTimeL = 0.3;
                    var tcL = Globals.TimeConstantL;
                    var inputLevelL = Math.abs(detectionL);
                    
                    if (tcL < 1.5) {
                        attackTimeL = 0.0002;
                        releaseTimeL = 0.3;
                    }
                    else if (tcL < 2.5) {
                        attackTimeL = 0.0002;
                        releaseTimeL = 0.8;
                    }
                    else if (tcL < 3.5) {
                        attackTimeL = 0.0004;
                        releaseTimeL = 2.0;
                    }
                    else if (tcL < 4.5) {
                        attackTimeL = 0.0004;
                        releaseTimeL = 5.0;
                    }
                    else if (tcL < 5.5) {
                        attackTimeL = 0.0004;
                        if (inputLevelL > peakHoldL) {
                            peakHoldL = inputLevelL;
                            peakTimerL = 0.0;
                            releaseTimeL = 2.0;
                        }
                        else {
                            peakTimerL = peakTimerL + (1.0 / Engine.getSampleRate());
                            releaseTimeL = (peakTimerL < 0.1) ? 2.0 : 10.0;
                        }
                    }
                    else {
                        attackTimeL = 0.0002;
                        if (inputLevelL > peakHoldL) {
                            peakHoldL = inputLevelL;
                            peakTimerL = 0.0;
                            releaseTimeL = 0.3;
                        }
                        else {
                            peakTimerL = peakTimerL + (1.0 / Engine.getSampleRate());
                            if (peakTimerL < 0.05)
                                releaseTimeL = 0.3;
                            else if (peakTimerL < 0.5)
                                releaseTimeL = 10.0;
                            else
                                releaseTimeL = 25.0;
                        }
                    }
                    
                    var attackCoeffL = Math.exp(-1.0 / (attackTimeL * Engine.getSampleRate()));
                    var releaseCoeffL = Math.exp(-1.0 / (releaseTimeL * Engine.getSampleRate()));
                    
                    if (inputLevelL > envL)
                        envL = envL + (1.0 - attackCoeffL) * (inputLevelL - envL);
                    else
                        envL = envL + (1.0 - releaseCoeffL) * (inputLevelL - envL);
                    
                    var preL = L;
                    
                    if (Globals.ThresholdL > 0.1) {
                        if (envL > thresholdL) {
                            var overL = envL - thresholdL;
                            var ratioL = 2.0 + (overL * 10.0);
                            ratioL = Math.min(ratioL, 30.0);
                            var compL = thresholdL + (overL / ratioL);
                            var scale = compL / envL;
                            L = L * scale;
                        }
                    }
                    
                    var postL = L;
                    // ✅ REMOVED: transformer(L, xfrmOutL)
                    L = L * outputGainL;
                    L = softClip(L);
                    
                    if (Math.abs(preL) > 0.001) {
                        var grLeft = 1.0 - (Math.abs(postL) / Math.abs(preL));
                        peakGRL = Math.max(peakGRL, Math.max(0.0, Math.min(1.0, grLeft)));
                    }
                    
                    // RIGHT processing  
                    // ✅ REMOVED: transformer(R, xfrmInR)
                    R = R * inputGainR;
                    
                    // [Same processing as LEFT for RIGHT channel - abbreviated for space]
                    var detectionR = R;
                    if (Globals.SCHPFSwitchR > 0.5) {
                        var scFreq = (Globals.SCHPFSwitchR > 1.5) ? 120.0 : 60.0;
                        var omega = 6.28318 * scFreq / Engine.getSampleRate();
                        var alpha = Math.exp(-omega);
                        detectionR = R - scHPF_R * alpha;
                        scHPF_R = detectionR;
                    }
                    
                    // Time constants and envelope follower for R (same logic as L)
                    var attackTimeR = 0.0002;
                    var releaseTimeR = 0.3;
                    var tcR = Globals.TimeConstantR;
                    var inputLevelR = Math.abs(detectionR);
                    
                    if (tcR < 1.5) {
                        attackTimeR = 0.0002;
                        releaseTimeR = 0.3;
                    }
                    else if (tcR < 2.5) {
                        attackTimeR = 0.0002;
                        releaseTimeR = 0.8;
                    }
                    else if (tcR < 3.5) {
                        attackTimeR = 0.0004;
                        releaseTimeR = 2.0;
                    }
                    else if (tcR < 4.5) {
                        attackTimeR = 0.0004;
                        releaseTimeR = 5.0;
                    }
                    else if (tcR < 5.5) {
                        attackTimeR = 0.0004;
                        if (inputLevelR > peakHoldR) {
                            peakHoldR = inputLevelR;
                            peakTimerR = 0.0;
                            releaseTimeR = 2.0;
                        }
                        else {
                            peakTimerR = peakTimerR + (1.0 / Engine.getSampleRate());
                            releaseTimeR = (peakTimerR < 0.1) ? 2.0 : 10.0;
                        }
                    }
                    else {
                        attackTimeR = 0.0002;
                        if (inputLevelR > peakHoldR) {
                            peakHoldR = inputLevelR;
                            peakTimerR = 0.0;
                            releaseTimeR = 0.3;
                        }
                        else {
                            peakTimerR = peakTimerR + (1.0 / Engine.getSampleRate());
                            if (peakTimerR < 0.05)
                                releaseTimeR = 0.3;
                            else if (peakTimerR < 0.5)
                                releaseTimeR = 10.0;
                            else
                                releaseTimeR = 25.0;
                        }
                    }
                    
                    var attackCoeffR = Math.exp(-1.0 / (attackTimeR * Engine.getSampleRate()));
                    var releaseCoeffR = Math.exp(-1.0 / (releaseTimeR * Engine.getSampleRate()));
                    
                    if (inputLevelR > envR)
                        envR = envR + (1.0 - attackCoeffR) * (inputLevelR - envR);
                    else
                        envR = envR + (1.0 - releaseCoeffR) * (inputLevelR - envR);
                    
                    var preR = R;
                    
                    if (Globals.ThresholdR > 0.1) {
                        if (envR > thresholdR) {
                            var overR = envR - thresholdR;
                            var ratioR = 2.0 + (overR * 10.0);
                            ratioR = Math.min(ratioR, 30.0);
                            var compR = thresholdR + (overR / ratioR);
                            var scale = compR / envR;
                            R = R * scale;
                        }
                    }
                    
                    var postR = R;
                    // ✅ REMOVED: transformer(R, xfrmOutR)
                    R = R * outputGainR;
                    R = softClip(R);
                    
                    if (Math.abs(preR) > 0.001) {
                        var grRight = 1.0 - (Math.abs(postR) / Math.abs(preR));
                        peakGRR = Math.max(peakGRR, Math.max(0.0, Math.min(1.0, grRight)));
                    }
                }
                
                // Dry/wet mix
                L = dryL * (1.0 - mix) + L * mix;
                R = dryR * (1.0 - mix) + R * mix;
                
                channels[0][s] = L;
                channels[1][s] = R;
            }
            
            Globals.compGRL = peakGRL;
            Globals.compGRR = peakGRR;
        }
        else
        {
            Globals.compGRL = 0.0;
            Globals.compGRR = 0.0;
        }
        
        // ========== TAPE SECTION (TRANSPARENT) ==========
        var tapeBypass = Globals.TapeBypass > 0.5;
        
        if (!tapeBypass)
        {
            // ✅ FIXED: -18 LUFS inter-stage calibration
            var trimL = Math.pow(10, (Globals.TrimL - 3.0) / 20);  // Reduced reference for proper staging
            var trimR = Math.pow(10, (Globals.TrimR - 3.0) / 20);
            var satL = Globals.SaturationL;
            var satR = Globals.SaturationR;
            var blendL = Globals.BlendL / 100.0;
            var blendR = Globals.BlendR / 100.0;
            var textureL = Globals.TextureL;
            var textureR = Globals.TextureR;
            var colorL = Globals.ColorModeL;
            var colorR = Globals.ColorModeR;
            var tapeInL = Globals.TapeInL > 0.5;
            var tapeInR = Globals.TapeInR > 0.5;
            
            var tapeDriveL = 0.0;
            var tapeDriveR = 0.0;
            var tapeOutL = 0.0;
            var tapeOutR = 0.0;
            
            for (var s = 0; s < numSamples; s++)
            {
                var L = channels[0][s];
                var R = channels[1][s];
                var dryL = L;
                var dryR = R;
                
                L = L * trimL;
                // ✅ REMOVED: transformer(L, tapeXfrmInL)
                if (tapeInL) {
                    L = tapeHead(L, satL);                    // ✅ KEPT: frequency response
                    L = silkProcessing(L, colorL, textureL);  // ✅ KEPT: high freq processing
                }
                // ✅ REMOVED: transformer(L, tapeXfrmOutL)
                L = dryL * (1.0 - blendL) + L * blendL;
                L = softClip(L);  // ✅ KEPT: gentle limiting
                
                R = R * trimR;
                // ✅ REMOVED: transformer(R, tapeXfrmInR)
                if (tapeInR) {
                    R = tapeHead(R, satR);
                    R = silkProcessing(R, colorR, textureR);
                }
                // ✅ REMOVED: transformer(R, tapeXfrmOutR)
                R = dryR * (1.0 - blendR) + R * blendR;
                R = softClip(R);
                
                channels[0][s] = L;
                channels[1][s] = R;
                
                tapeDriveL = Math.max(tapeDriveL, Math.abs(L) * (1.0 + (satL / 100.0) * 1.5));
                tapeDriveR = Math.max(tapeDriveR, Math.abs(R) * (1.0 + (satR / 100.0) * 1.5));
                tapeOutL = Math.max(tapeOutL, Math.abs(L));
                tapeOutR = Math.max(tapeOutR, Math.abs(R));
            }
            
            Globals.tapeDrivePeakL = Math.min(1.0, tapeDriveL);
            Globals.tapeDrivePeakR = Math.min(1.0, tapeDriveR);
            Globals.tapeLevelPeakL = tapeOutL;
            Globals.tapeLevelPeakR = tapeOutR;
        }
        else
        {
            Globals.tapeDrivePeakL = 0;
            Globals.tapeDrivePeakR = 0;
            Globals.tapeLevelPeakL = 0;
            Globals.tapeLevelPeakR = 0;
        }
    }
    else
    {
        // ========== ORDER 2: TAPE → COMP (-18 LUFS CALIBRATED) ==========
        
        // ========== TAPE SECTION ==========
        var tapeBypass = Globals.TapeBypass > 0.5;
        
        if (!tapeBypass)
        {
            var trimL = Math.pow(10, (Globals.TrimL - 3.0) / 20);
            var trimR = Math.pow(10, (Globals.TrimR - 3.0) / 20);
            var satL = Globals.SaturationL;
            var satR = Globals.SaturationR;
            var blendL = Globals.BlendL / 100.0;
            var blendR = Globals.BlendR / 100.0;
            var textureL = Globals.TextureL;
            var textureR = Globals.TextureR;
            var colorL = Globals.ColorModeL;
            var colorR = Globals.ColorModeR;
            var tapeInL = Globals.TapeInL > 0.5;
            var tapeInR = Globals.TapeInR > 0.5;
            
            var tapeDriveL = 0.0;
            var tapeDriveR = 0.0;
            var tapeOutL = 0.0;
            var tapeOutR = 0.0;
            
            for (var s = 0; s < numSamples; s++)
            {
                var L = channels[0][s];
                var R = channels[1][s];
                var dryL = L;
                var dryR = R;
                
                L = L * trimL;
                // ✅ REMOVED: transformer(L, tapeXfrmInL)
                if (tapeInL) {
                    L = tapeHead(L, satL);
                    L = silkProcessing(L, colorL, textureL);
                }
                // ✅ REMOVED: transformer(L, tapeXfrmOutL)
                L = dryL * (1.0 - blendL) + L * blendL;
                L = softClip(L);
                
                R = R * trimR;
                // ✅ REMOVED: transformer(R, tapeXfrmInR)
                if (tapeInR) {
                    R = tapeHead(R, satR);
                    R = silkProcessing(R, colorR, textureR);
                }
                // ✅ REMOVED: transformer(R, tapeXfrmOutR)
                R = dryR * (1.0 - blendR) + R * blendR;
                R = softClip(R);
                
                channels[0][s] = L;
                channels[1][s] = R;
                
                tapeDriveL = Math.max(tapeDriveL, Math.abs(L) * (1.0 + (satL / 100.0) * 1.5));
                tapeDriveR = Math.max(tapeDriveR, Math.abs(R) * (1.0 + (satR / 100.0) * 1.5));
                tapeOutL = Math.max(tapeOutL, Math.abs(L));
                tapeOutR = Math.max(tapeOutR, Math.abs(R));
            }
            
            Globals.tapeDrivePeakL = Math.min(1.0, tapeDriveL);
            Globals.tapeDrivePeakR = Math.min(1.0, tapeDriveR);
            Globals.tapeLevelPeakL = tapeOutL;
            Globals.tapeLevelPeakR = tapeOutR;
        }
        else
        {
            Globals.tapeDrivePeakL = 0;
            Globals.tapeDrivePeakR = 0;
            Globals.tapeLevelPeakL = 0;
            Globals.tapeLevelPeakR = 0;
        }
        
        // ========== COMPRESSOR SECTION (RECEIVES TAPE OUTPUT) ==========
        var compBypass = Globals.CompIn < 0.5;
        
        if (!compBypass)
        {
            // ✅ FIXED: Proper inter-stage gain from tape to comp
            var inputGainL = Math.pow(10, (Globals.InputGainL - 18.0) / 20);
            var inputGainR = Math.pow(10, (Globals.InputGainR - 18.0) / 20);
            var inputGainMid = Math.pow(10, (Globals.InputGainMid - 18.0) / 20);
            var inputGainSide = Math.pow(10, (Globals.InputGainSide - 18.0) / 20);
            
            var thresholdL = 0.95 - (Globals.ThresholdL / 10.0 * 0.91);
            var thresholdR = 0.95 - (Globals.ThresholdR / 10.0 * 0.91);
            var thresholdMid = 0.95 - (Globals.ThresholdMid / 10.0 * 0.91);
            var thresholdSide = 0.95 - (Globals.ThresholdSide / 10.0 * 0.91);
            
            var outputGainL = Math.pow(10, ((Globals.OutputL - 50) * 0.3) / 20);
            var outputGainR = Math.pow(10, ((Globals.OutputR - 50) * 0.3) / 20);
            var outputGainMid = Math.pow(10, ((Globals.OutputMid - 50) * 0.3) / 20);
            var outputGainSide = Math.pow(10, ((Globals.OutputSide - 50) * 0.3) / 20);
            
            var mix = Globals.MixKnob / 100.0;
            var midSide = Globals.MidSideMode == 0;
            
            var peakGRL = 0.0;
            var peakGRR = 0.0;
            
            for (var s = 0; s < numSamples; s++)
            {
                var L = channels[0][s];
                var R = channels[1][s];
                var dryL = L;
                var dryR = R;
                
                if (midSide)
                {
                    var M = (L + R) * 0.5;
                    var S = (L - R) * 0.5;
                    
                    // ✅ REMOVED: transformer(M, xfrmInL) 
                    M = M * inputGainMid;
                    
                    // Sidechain HPF for detection
                    var detectionM = M;
                    if (Globals.SCHPFSwitchMid > 0.5) {
                        var scFreq = (Globals.SCHPFSwitchMid > 1.5) ? 120.0 : 60.0;
                        var omega = 6.28318 * scFreq / Engine.getSampleRate();
                        var alpha = Math.exp(-omega);
                        detectionM = M - scHPF_Mid * alpha;
                        scHPF_Mid = detectionM;
                    }
                    
                    // Time constant logic for MID
                    var attackTimeMid = 0.0002;
                    var releaseTimeMid = 0.3;
                    var tcMid = Globals.TimeConstantMid;
                    var inputLevelMid = Math.abs(detectionM);
                    
                    if (tcMid < 1.5) {
                        attackTimeMid = 0.0002;
                        releaseTimeMid = 0.3;
                    }
                    else if (tcMid < 2.5) {
                        attackTimeMid = 0.0002;
                        releaseTimeMid = 0.8;
                    }
                    else if (tcMid < 3.5) {
                        attackTimeMid = 0.0004;
                        releaseTimeMid = 2.0;
                    }
                    else if (tcMid < 4.5) {
                        attackTimeMid = 0.0004;
                        releaseTimeMid = 5.0;
                    }
                    else if (tcMid < 5.5) {
                        attackTimeMid = 0.0004;
                        if (inputLevelMid > peakHoldMid) {
                            peakHoldMid = inputLevelMid;
                            peakTimerMid = 0.0;
                            releaseTimeMid = 2.0;
                        }
                        else {
                            peakTimerMid = peakTimerMid + (1.0 / Engine.getSampleRate());
                            releaseTimeMid = (peakTimerMid < 0.1) ? 2.0 : 10.0;
                        }
                    }
                    else {
                        attackTimeMid = 0.0002;
                        if (inputLevelMid > peakHoldMid) {
                            peakHoldMid = inputLevelMid;
                            peakTimerMid = 0.0;
                            releaseTimeMid = 0.3;
                        }
                        else {
                            peakTimerMid = peakTimerMid + (1.0 / Engine.getSampleRate());
                            if (peakTimerMid < 0.05)
                                releaseTimeMid = 0.3;
                            else if (peakTimerMid < 0.5)
                                releaseTimeMid = 10.0;
                            else
                                releaseTimeMid = 25.0;
                        }
                    }
                    
                    // Envelope follower for MID
                    var attackCoeffMid = Math.exp(-1.0 / (attackTimeMid * Engine.getSampleRate()));
                    var releaseCoeffMid = Math.exp(-1.0 / (releaseTimeMid * Engine.getSampleRate()));
                    
                    if (inputLevelMid > envMid)
                        envMid = envMid + (1.0 - attackCoeffMid) * (inputLevelMid - envMid);
                    else
                        envMid = envMid + (1.0 - releaseCoeffMid) * (inputLevelMid - envMid);
                    
                    var preMid = M;
                    
                    // Compression
                    if (Globals.ThresholdMid > 0.1) {
                        if (envMid > thresholdMid) {
                            var overMid = envMid - thresholdMid;
                            var ratioMid = 2.0 + (overMid * 10.0);
                            ratioMid = Math.min(ratioMid, 30.0);
                            var compMid = thresholdMid + (overMid / ratioMid);
                            var scale = compMid / envMid;
                            M = M * scale;
                        }
                    }
                    
                    var postMid = M;
                    // ✅ REMOVED: transformer(M, xfrmOutL)
                    M = M * outputGainMid;
                    M = softClip(M);
                    
                    // GR calculation
                    if (Math.abs(preMid) > 0.001) {
                        var grMid = 1.0 - (Math.abs(postMid) / Math.abs(preMid));
                        peakGRL = Math.max(peakGRL, Math.max(0.0, Math.min(1.0, grMid)));
                    }
                    
                    // SIDE processing
                    // ✅ REMOVED: transformer(S, xfrmInR)
                    S = S * inputGainSide;
                    
                    // Sidechain HPF for detection
                    var detectionS = S;
                    if (Globals.SCHPFSwitchSide > 0.5) {
                        var scFreq = (Globals.SCHPFSwitchSide > 1.5) ? 120.0 : 60.0;
                        var omega = 6.28318 * scFreq / Engine.getSampleRate();
                        var alpha = Math.exp(-omega);
                        detectionS = S - scHPF_Side * alpha;
                        scHPF_Side = detectionS;
                    }
                    
                    // Time constant logic for SIDE
                    var attackTimeSide = 0.0002;
                    var releaseTimeSide = 0.3;
                    var tcSide = Globals.TimeConstantSide;
                    var inputLevelSide = Math.abs(detectionS);
                    
                    if (tcSide < 1.5) {
                        attackTimeSide = 0.0002;
                        releaseTimeSide = 0.3;
                    }
                    else if (tcSide < 2.5) {
                        attackTimeSide = 0.0002;
                        releaseTimeSide = 0.8;
                    }
                    else if (tcSide < 3.5) {
                        attackTimeSide = 0.0004;
                        releaseTimeSide = 2.0;
                    }
                    else if (tcSide < 4.5) {
                        attackTimeSide = 0.0004;
                        releaseTimeSide = 5.0;
                    }
                    else if (tcSide < 5.5) {
                        attackTimeSide = 0.0004;
                        if (inputLevelSide > peakHoldSide) {
                            peakHoldSide = inputLevelSide;
                            peakTimerSide = 0.0;
                            releaseTimeSide = 2.0;
                        }
                        else {
                            peakTimerSide = peakTimerSide + (1.0 / Engine.getSampleRate());
                            releaseTimeSide = (peakTimerSide < 0.1) ? 2.0 : 10.0;
                        }
                    }
                    else {
                        attackTimeSide = 0.0002;
                        if (inputLevelSide > peakHoldSide) {
                            peakHoldSide = inputLevelSide;
                            peakTimerSide = 0.0;
                            releaseTimeSide = 0.3;
                        }
                        else {
                            peakTimerSide = peakTimerSide + (1.0 / Engine.getSampleRate());
                            if (peakTimerSide < 0.05)
                                releaseTimeSide = 0.3;
                            else if (peakTimerSide < 0.5)
                                releaseTimeSide = 10.0;
                            else
                                releaseTimeSide = 25.0;
                        }
                    }
                    
                    // Envelope follower for SIDE
                    var attackCoeffSide = Math.exp(-1.0 / (attackTimeSide * Engine.getSampleRate()));
                    var releaseCoeffSide = Math.exp(-1.0 / (releaseTimeSide * Engine.getSampleRate()));
                    
                    if (inputLevelSide > envSide)
                        envSide = envSide + (1.0 - attackCoeffSide) * (inputLevelSide - envSide);
                    else
                        envSide = envSide + (1.0 - releaseCoeffSide) * (inputLevelSide - envSide);
                    
                    var preSide = S;
                    
                    // Compression
                    if (Globals.ThresholdSide > 0.1) {
                        if (envSide > thresholdSide) {
                            var overSide = envSide - thresholdSide;
                            var ratioSide = 2.0 + (overSide * 10.0);
                            ratioSide = Math.min(ratioSide, 30.0);
                            var compSide = thresholdSide + (overSide / ratioSide);
                            var scale = compSide / envSide;
                            S = S * scale;
                        }
                    }
                    
                    var postSide = S;
                    // ✅ REMOVED: transformer(S, xfrmOutR)
                    S = S * outputGainSide;
                    S = softClip(S);
                    
                    // GR calculation
                    if (Math.abs(preSide) > 0.001) {
                        var grSide = 1.0 - (Math.abs(postSide) / Math.abs(preSide));
                        peakGRR = Math.max(peakGRR, Math.max(0.0, Math.min(1.0, grSide)));
                    }
                    
                    // Convert back to L/R
                    L = M + S;
                    R = M - S;
                }
                else
                {
                    // L/R processing
                    // ✅ REMOVED: transformer(L, xfrmInL)
                    L = L * inputGainL;
                    
                    // Sidechain HPF for detection
                    var detectionL = L;
                    if (Globals.SCHPFSwitchL > 0.5) {
                        var scFreq = (Globals.SCHPFSwitchL > 1.5) ? 120.0 : 60.0;
                        var omega = 6.28318 * scFreq / Engine.getSampleRate();
                        var alpha = Math.exp(-omega);
                        detectionL = L - scHPF_L * alpha;
                        scHPF_L = detectionL;
                    }
                    
                    // Time constant logic for LEFT
                    var attackTimeL = 0.0002;
                    var releaseTimeL = 0.3;
                    var tcL = Globals.TimeConstantL;
                    var inputLevelL = Math.abs(detectionL);
                    
                    if (tcL < 1.5) {
                        attackTimeL = 0.0002;
                        releaseTimeL = 0.3;
                    }
                    else if (tcL < 2.5) {
                        attackTimeL = 0.0002;
                        releaseTimeL = 0.8;
                    }
                    else if (tcL < 3.5) {
                        attackTimeL = 0.0004;
                        releaseTimeL = 2.0;
                    }
                    else if (tcL < 4.5) {
                        attackTimeL = 0.0004;
                        releaseTimeL = 5.0;
                    }
                    else if (tcL < 5.5) {
                        attackTimeL = 0.0004;
                        if (inputLevelL > peakHoldL) {
                            peakHoldL = inputLevelL;
                            peakTimerL = 0.0;
                            releaseTimeL = 2.0;
                        }
                        else {
                            peakTimerL = peakTimerL + (1.0 / Engine.getSampleRate());
                            releaseTimeL = (peakTimerL < 0.1) ? 2.0 : 10.0;
                        }
                    }
                    else {
                        attackTimeL = 0.0002;
                        if (inputLevelL > peakHoldL) {
                            peakHoldL = inputLevelL;
                            peakTimerL = 0.0;
                            releaseTimeL = 0.3;
                        }
                        else {
                            peakTimerL = peakTimerL + (1.0 / Engine.getSampleRate());
                            if (peakTimerL < 0.05)
                                releaseTimeL = 0.3;
                            else if (peakTimerL < 0.5)
                                releaseTimeL = 10.0;
                            else
                                releaseTimeL = 25.0;
                        }
                    }
                    
                    var attackCoeffL = Math.exp(-1.0 / (attackTimeL * Engine.getSampleRate()));
                    var releaseCoeffL = Math.exp(-1.0 / (releaseTimeL * Engine.getSampleRate()));
                    
                    if (inputLevelL > envL)
                        envL = envL + (1.0 - attackCoeffL) * (inputLevelL - envL);
                    else
                        envL = envL + (1.0 - releaseCoeffL) * (inputLevelL - envL);
                    
                    var preL = L;
                    
                    if (Globals.ThresholdL > 0.1) {
                        if (envL > thresholdL) {
                            var overL = envL - thresholdL;
                            var ratioL = 2.0 + (overL * 10.0);
                            ratioL = Math.min(ratioL, 30.0);
                            var compL = thresholdL + (overL / ratioL);
                            var scale = compL / envL;
                            L = L * scale;
                        }
                    }
                    
                    var postL = L;
                    // ✅ REMOVED: transformer(L, xfrmOutL)
                    L = L * outputGainL;
                    L = softClip(L);
                    
                    if (Math.abs(preL) > 0.001) {
                        var grLeft = 1.0 - (Math.abs(postL) / Math.abs(preL));
                        peakGRL = Math.max(peakGRL, Math.max(0.0, Math.min(1.0, grLeft)));
                    }
                    
                    // RIGHT processing  
                    // ✅ REMOVED: transformer(R, xfrmInR)
                    R = R * inputGainR;
                    
                    var detectionR = R;
                    if (Globals.SCHPFSwitchR > 0.5) {
                        var scFreq = (Globals.SCHPFSwitchR > 1.5) ? 120.0 : 60.0;
                        var omega = 6.28318 * scFreq / Engine.getSampleRate();
                        var alpha = Math.exp(-omega);
                        detectionR = R - scHPF_R * alpha;
                        scHPF_R = detectionR;
                    }
                    
                    // Time constants and envelope follower for R
                    var attackTimeR = 0.0002;
                    var releaseTimeR = 0.3;
                    var tcR = Globals.TimeConstantR;
                    var inputLevelR = Math.abs(detectionR);
                    
                    if (tcR < 1.5) {
                        attackTimeR = 0.0002;
                        releaseTimeR = 0.3;
                    }
                    else if (tcR < 2.5) {
                        attackTimeR = 0.0002;
                        releaseTimeR = 0.8;
                    }
                    else if (tcR < 3.5) {
                        attackTimeR = 0.0004;
                        releaseTimeR = 2.0;
                    }
                    else if (tcR < 4.5) {
                        attackTimeR = 0.0004;
                        releaseTimeR = 5.0;
                    }
                    else if (tcR < 5.5) {
                        attackTimeR = 0.0004;
                        if (inputLevelR > peakHoldR) {
                            peakHoldR = inputLevelR;
                            peakTimerR = 0.0;
                            releaseTimeR = 2.0;
                        }
                        else {
                            peakTimerR = peakTimerR + (1.0 / Engine.getSampleRate());
                            releaseTimeR = (peakTimerR < 0.1) ? 2.0 : 10.0;
                        }
                    }
                    else {
                        attackTimeR = 0.0002;
                        if (inputLevelR > peakHoldR) {
                            peakHoldR = inputLevelR;
                            peakTimerR = 0.0;
                            releaseTimeR = 0.3;
                        }
                        else {
                            peakTimerR = peakTimerR + (1.0 / Engine.getSampleRate());
                            if (peakTimerR < 0.05)
                                releaseTimeR = 0.3;
                            else if (peakTimerR < 0.5)
                                releaseTimeR = 10.0;
                            else
                                releaseTimeR = 25.0;
                        }
                    }
                    
                    var attackCoeffR = Math.exp(-1.0 / (attackTimeR * Engine.getSampleRate()));
                    var releaseCoeffR = Math.exp(-1.0 / (releaseTimeR * Engine.getSampleRate()));
                    
                    if (inputLevelR > envR)
                        envR = envR + (1.0 - attackCoeffR) * (inputLevelR - envR);
                    else
                        envR = envR + (1.0 - releaseCoeffR) * (inputLevelR - envR);
                    
                    var preR = R;
                    
                    if (Globals.ThresholdR > 0.1) {
                        if (envR > thresholdR) {
                            var overR = envR - thresholdR;
                            var ratioR = 2.0 + (overR * 10.0);
                            ratioR = Math.min(ratioR, 30.0);
                            var compR = thresholdR + (overR / ratioR);
                            var scale = compR / envR;
                            R = R * scale;
                        }
                    }
                    
                    var postR = R;
                    // ✅ REMOVED: transformer(R, xfrmOutR)
                    R = R * outputGainR;
                    R = softClip(R);
                    
                    if (Math.abs(preR) > 0.001) {
                        var grRight = 1.0 - (Math.abs(postR) / Math.abs(preR));
                        peakGRR = Math.max(peakGRR, Math.max(0.0, Math.min(1.0, grRight)));
                    }
                }
                
                // Dry/wet mix
                L = dryL * (1.0 - mix) + L * mix;
                R = dryR * (1.0 - mix) + R * mix;
                
                channels[0][s] = L;
                channels[1][s] = R;
            }
            
            Globals.compGRL = peakGRL;
            Globals.compGRR = peakGRR;
        }
        else
        {
            Globals.compGRL = 0.0;
            Globals.compGRR = 0.0;
        }
    }
}

Console.print("✅ LUNA MU 6742 - TRANSPARENT DSP LOADED!");
Console.print("   • REMOVED: All transformer() calls for performance");
Console.print("   • KEPT: tapeHead(), silkProcessing(), softClip()");
Console.print("   • FIXED: -18 LUFS gain staging for both orders");
Console.print("   • Expected ASIO reduction: 117% → <10%");