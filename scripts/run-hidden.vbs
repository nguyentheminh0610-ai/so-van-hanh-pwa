' Chay 1 script PowerShell HOAN TOAN AN (khong nhay cua so console).
' Ly do (31/10/2026): "powershell.exe -WindowStyle Hidden" van nhay 1 cua so trong
' tich tac, du de game fullscreen bi day ra desktop. wscript //B voi window style 0
' thi khong hien gi ca.
' Dung: wscript.exe //B //Nologo run-hidden.vbs "<duong-dan-file.ps1>"
If WScript.Arguments.Count < 1 Then WScript.Quit 1
Set sh = CreateObject("WScript.Shell")
cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File """ & WScript.Arguments(0) & """"
WScript.Quit sh.Run(cmd, 0, True)
