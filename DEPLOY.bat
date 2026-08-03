@echo off
echo ================================
echo  MarmoApp - Deploy para Vercel
echo ================================
echo.

cd /d "%~dp0"

echo [1/4] Removendo git lock se existir...
if exist ".git\index.lock" (
    del /f ".git\index.lock"
    echo       Lock removido.
) else (
    echo       Sem lock.
)

echo.
echo [2/4] Adicionando arquivos...
git add marmoapp/app/api/leads/route.ts
if %errorlevel% neq 0 (
    echo ERRO no git add. Feche o Cursor e tente novamente.
    pause
    exit /b 1
)

echo.
echo [3/4] Commitando...
git commit -m "fix: remover import email/sequences inexistente do leads/route.ts"
if %errorlevel% neq 0 (
    echo Nada para commitar ou erro. Verifique o status acima.
    pause
    exit /b 1
)

echo.
echo [4/4] Fazendo push para main (Vercel vai deployar automaticamente)...
git push origin main
if %errorlevel% neq 0 (
    echo ERRO no push. Verifique sua conexao ou credenciais git.
    pause
    exit /b 1
)

echo.
echo ================================
echo  DEPLOY ENVIADO COM SUCESSO!
echo  Vercel vai publicar em ~2 min.
echo  Acesse: app.marmoapp.com/cadastro
echo ================================
echo.
pause
