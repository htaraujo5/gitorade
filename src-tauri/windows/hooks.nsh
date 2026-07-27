; Gitorade NSIS hooks — wipe all app data on uninstall (no leftovers).
; Paths used historically + Tauri bundle id.

!macro NSIS_HOOK_POSTUNINSTALL
  SetShellVarContext current

  ; SQLite / app DB (legacy folder name)
  RmDir /r "$APPDATA\gitorade"
  RmDir /r "$LOCALAPPDATA\gitorade"

  ; Tauri / WebView2 data (bundle identifier)
  RmDir /r "$APPDATA\com.gitorade.desktop"
  RmDir /r "$LOCALAPPDATA\com.gitorade.desktop"

  ; Product-name variants some builds may use
  RmDir /r "$APPDATA\Gitorade"
  RmDir /r "$LOCALAPPDATA\Gitorade"
!macroend
