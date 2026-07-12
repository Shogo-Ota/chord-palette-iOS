Pod::Spec.new do |s|
  s.name           = 'ChordAudio'
  s.version        = '1.0.0'
  s.summary        = 'Chord Palette native audio engine (Phase 2A verification synth).'
  s.description    = 'Synthesized, synchronized chord + drum playback via AVAudioEngine. Verification-only synth; Phase 2B swaps in sampled instruments through InstrumentProvider/DrumProvider.'
  s.author         = 'Chord Palette'
  s.homepage       = 'https://chord-palette.app'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
