' Chay 1 script PowerShell HOAN TOAN AN (khong nhay cua so console).
' Ly do (31/10/2026): "powershell.exe -WindowStyle Hidden" van nhay 1 cua so trong
' tich tac, du de game fullscreen bi day ra desktop. wscript //B voi window style 0
' thi khong hien gi ca.
' Dung: wscript.exe //B //Nologo run-hidden.vbs "<duong-dan-file.ps1>" [tham so them cho file .ps1 ...]
' 26/11/2026: cho phep truyen them tham so (vd: run-job.ps1 -Job kho) de MOI task
' deu di qua file nay, khong con task nao goi thang powershell.exe / python.exe.
If WScript.Arguments.Count < 1 Then WScript.Quit 1
Set sh = CreateObject("WScript.Shell")
cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File """ & WScript.Arguments(0) & """"
For i = 1 To WScript.Arguments.Count - 1
  a = WScript.Arguments(i)
  If InStr(a, " ") > 0 Then a = """" & a & """"
  cmd = cmd & " " & a
Next
WScript.Quit sh.Run(cmd, 0, True)
