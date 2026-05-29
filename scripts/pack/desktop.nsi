; AI Personal Assistant NSIS installer. Run makensis from repo root after
; building dist/win-unpacked (see scripts/pack/build_win.ps1).
; Usage: makensis /DAIPA_VERSION=1.2.3 /DOUTPUT_EXE=dist\AI-Personal-Assistant-Setup-1.2.3.exe scripts\pack\desktop.nsi

!include "MUI2.nsh"
!define MUI_ABORTWARNING
; Use custom icon from unpacked env (copied by build_win.ps1)
!define MUI_ICON "${UNPACKED}\icon.ico"
!define MUI_UNICON "${UNPACKED}\icon.ico"

!ifndef AIPA_VERSION
  !define AIPA_VERSION "0.0.0"
!endif
!ifndef OUTPUT_EXE
  !define OUTPUT_EXE "dist\AI-Personal-Assistant-Setup-${AIPA_VERSION}.exe"
!endif

Name "AI Personal Assistant"
OutFile "${OUTPUT_EXE}"
InstallDir "$LOCALAPPDATA\AIPersonalAssistant"
InstallDirRegKey HKCU "Software\AIPersonalAssistant" "InstallPath"
RequestExecutionLevel user

!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "SimpChinese"

; Pass /DUNPACKED=full_path from build_win.ps1 so path works when cwd != repo root
!ifndef UNPACKED
  !define UNPACKED "dist\win-unpacked"
!endif

Section "AI Personal Assistant" SEC01
  SetOutPath "$INSTDIR"
  File /r "${UNPACKED}\*.*"
  WriteRegStr HKCU "Software\AIPersonalAssistant" "InstallPath" "$INSTDIR"
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  ; Main shortcut - uses VBS to hide console window
  CreateShortcut "$SMPROGRAMS\AI Personal Assistant.lnk" "$INSTDIR\AI Personal Assistant.vbs" "" "$INSTDIR\icon.ico" 0
  CreateShortcut "$DESKTOP\AI Personal Assistant.lnk" "$INSTDIR\AI Personal Assistant.vbs" "" "$INSTDIR\icon.ico" 0

  ; Debug shortcut - shows console window for troubleshooting
  CreateShortcut "$SMPROGRAMS\AI Personal Assistant (Debug).lnk" "$INSTDIR\AI Personal Assistant (Debug).bat" "" "$INSTDIR\icon.ico" 0
SectionEnd

Section "Uninstall"
  Delete "$SMPROGRAMS\AI Personal Assistant.lnk"
  Delete "$SMPROGRAMS\AI Personal Assistant (Debug).lnk"
  Delete "$DESKTOP\AI Personal Assistant.lnk"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "Software\AIPersonalAssistant"
SectionEnd
