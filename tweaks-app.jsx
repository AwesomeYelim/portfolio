/* Tweaks panel — controls the dance floor + music. Hidden until Tweaks mode on. */
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "colorMode": "party",
  "intensity": 1.0,
  "crowd": 56,
  "accent": "#5383E8",
  "volume": 0.7
}/*EDITMODE-END*/;

function TweaksApp() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  React.useEffect(() => {
    const DF = window.DanceFloor;
    if (DF) { DF.setColorMode(t.colorMode); DF.setIntensity(t.intensity); DF.setCrowd(t.crowd); }
    document.documentElement.style.setProperty('--accent', t.accent);
    if (window.MusicCtl) window.MusicCtl.setVolume(t.volume);
  }, [t.colorMode, t.intensity, t.crowd, t.accent, t.volume]);

  return (
    <TweaksPanel title="Tweaks">
      <TweakSection label="Dance floor" />
      <TweakRadio label="Color mode" value={t.colorMode}
        options={['party', 'mono']}
        onChange={(v) => setTweak('colorMode', v)} />
      <TweakSlider label="Dance energy" value={t.intensity} min={0.4} max={1.8} step={0.1}
        onChange={(v) => setTweak('intensity', v)} />
      <TweakSlider label="Crowd size" value={t.crowd} min={16} max={96} step={4} unit="명"
        onChange={(v) => setTweak('crowd', v)} />

      <TweakSection label="Accent" />
      <TweakColor label="Brand accent" value={t.accent}
        options={['#5383E8', '#3A6BD9', '#7B5BE8', '#35C2C8', '#F2724B']}
        onChange={(v) => setTweak('accent', v)} />

      <TweakSection label="Music" />
      <TweakSlider label="Volume" value={t.volume} min={0} max={1} step={0.05}
        onChange={(v) => setTweak('volume', v)} />
    </TweaksPanel>
  );
}

ReactDOM.createRoot(document.getElementById('tweaks-root')).render(<TweaksApp />);
