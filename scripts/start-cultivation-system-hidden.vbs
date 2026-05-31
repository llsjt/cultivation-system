Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
projectRoot = fso.GetParentFolderName(scriptDir)
shell.CurrentDirectory = projectRoot

shell.Run "cmd.exe /c """ & fso.BuildPath(scriptDir, "start-cultivation-system.cmd") & """", 0, False
