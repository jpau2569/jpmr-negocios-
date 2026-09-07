' ============================================================================
'  Fotos Faciles - arranque SILENCIOSO (sin ventana negra)
' ----------------------------------------------------------------------------
'  Hace lo mismo que FotosFaciles.bat pero sin abrir ninguna ventana: el
'  programa queda funcionando en segundo plano. Es lo que usa el arranque
'  automatico con Windows (ver herramientas/arranque-automatico.ps1).
'
'  Para apagarlo: abre http://localhost:4321 y pulsa el boton "Salir".
' ============================================================================
Option Explicit

Dim sh, fso, carpeta, node

Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
carpeta = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = carpeta

' Si Node no esta instalado no se puede hacer nada, y en silencio no se veria:
' se avisa una sola vez con una ventanita.
On Error Resume Next
node = sh.Exec("cmd /c node -v").StdOut.ReadAll()
If Err.Number <> 0 Or InStr(node, "v") = 0 Then
  Err.Clear
  MsgBox "Falta Node.js. Instalalo desde https://nodejs.org (version LTS) y vuelve a intentarlo.", _
         48, "Fotos Faciles"
  WScript.Quit 1
End If
On Error GoTo 0

' 0 = ventana oculta, False = no esperar a que termine.
sh.Run "cmd /c node ""iniciar.mjs"" --sin-navegador", 0, False
