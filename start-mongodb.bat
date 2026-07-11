@echo off
echo Starting MongoDB for St. Louis College Jos website...
if not exist "data\db" mkdir "data\db"
"C:\Program Files\MongoDB\Server\4.4\bin\mongod.exe" --dbpath "%~dp0data\db" --port 27017
