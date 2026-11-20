# Doodle Aquarium 🐠

Build your own 3D aquarium, draw your own creatures, and watch them come to life. Then make the aquarium your live desktop wallpaper.

## Opening it
Double-click **Doodle Aquarium** on the Desktop or in the Start menu. A little fish icon also lives in the system tray (bottom-right, near the clock). Right-click it to:
- open your aquarium
- feed the fish
- turn the live wallpaper on or off
- start it when Windows starts
- exit

## Making your aquarium
- **Tanks**: pick a starting tank (Coral reef, Freshwater garden, Kelp forest, Sunken treasure, Deep sea glow, Candy castle, or an empty one).
- **Decorate**: pick a plant, coral, rock, ornament or animal, then click the sand to place it. Hold **Shift** to place lots. Switch to **Move things** to drag, turn (mouse wheel), resize, re-colour or remove things.
- **Creatures**: **Draw one here** or **Use a picture** (a photo of your drawing works great). You can also drag a picture onto the window.
  - The app removes the paper background automatically. If bits are missing, move the *Background remover* slider.
  - Choose which way its face is looking and how it moves: Fish, Wiggly eel, Jellyfish, Floaty person (great for divers and people), or Crawler (crabs, snails).
  - In the drawing pad, the **🧩 Parts** box has eyes, mouths, teeth, fins, tails, gills and patterns, bodies, tentacles and claws, people pieces and fun extras (hats, glasses, scuba mask…). Pick a colour first, then a part. Use ✋ to drag parts around, and drag the round blue handle to resize and turn them. **📌 Stick down** glues a part onto the drawing so you can draw over it.
- **Saved**: everything saves by itself. Here you can rename your aquarium, make a **New aquarium**, **Save a copy**, and **Open** any of your saved aquariums. Whichever one is open is the one shown on the wallpaper.
- **Lights**: Sunny day, Morning, Sunset, Moonlight, Glow party, Disco, plus water colour, sun rays, bubbles and the floor type.

## Playing
- **Poke & feed**: click a creature to poke it (poke it 3 times quickly and it puffs up!), or click the water to drop food.
- **Feed everyone** sprinkles food from the top.
- Point at a creature to see its name. Some curious fish swim over to look at your mouse.

## Live wallpaper
Press **Make it my wallpaper**. Then on your desktop:
- click a creature to poke it
- click empty water to feed the fish

The wallpaper pauses itself when a maximised window covers the desktop, so it doesn't slow the computer down.

## For grown-ups
- Nothing is installed: the app is `DoodleAquarium.exe` in this folder. It uses the C# compiler and Microsoft Edge that come with Windows 11.
- **AVG antivirus:** AVG's AutoSandbox once ran this app (unsigned and freshly compiled) inside its sandbox. Saves made there were hidden from the app afterwards, so it looked like nothing was saved. `C:\code\aquarium\DoodleAquarium.exe` is now on AVG's exception list. Keep it there, and re-check after rebuilding the exe. The app now shows "✓ All saved" under its name, and turns red with "⚠️ Not saved!" if saving fails. If it can't read the saved aquarium, it says so instead of starting a blank one. Backups from the repair are in `backups\`.
- Rebuild after changing `src/DoodleAquarium.cs`: `powershell -ExecutionPolicy Bypass -File build.ps1` (add `-Shortcuts` to recreate the Desktop and Start-menu shortcuts).
- The aquarium on screen is saved in `%APPDATA%\DoodleAquarium\aquarium.json`, with a `.bak` copy of the previous save next to it. Saved aquariums are in `%APPDATA%\DoodleAquarium\profiles\` (`<id>.json` plus `<id>.meta.json` for the name and picture). A copy taken just before saved aquariums were added is in `aquarium-before-profiles.json`.
- The 3D engine and editor are plain HTML/JavaScript in `web/` (WebGL2, no libraries).
- To remove it: exit from the tray icon, untick "Start with Windows", then delete this folder, the two shortcuts, `%APPDATA%\DoodleAquarium` and `%LOCALAPPDATA%\DoodleAquarium`.
