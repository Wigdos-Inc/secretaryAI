<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Register</title>
    <link rel="stylesheet" href="../bootstrap-5.3.6-dist/css/bootstrap.min.css">
    <link rel="stylesheet" href="../styling/main.css">
</head>
<body>
    <div class="container text-center m-5">
        <h2 class="mb-5 fw-bold">Register</h2>
        <?php if(isset($_GET['err'])){ ?>
        <h3 id="error" class="text-danger">Error: <?=$_GET['err']?></h3>
        <?php }?>
        <form style="overflow-y: auto; height: 70vh" class="rounded p-4 bg-purple-dark w-50 d-inline-block shadow" action="../scripts/db/account/register.php" method="post">
            <div class="form-floating mb-3 mt-5">
                <input class="form-control" type="text" name="username" id="username" placeholder="Username ...">
                <label for="username">Username ...</label>
            </div>
            <div class="form-floating mb-3">
                <input class="form-control" type="email" name="email" id="email" placeholder="E-mail ...">
                <label for="email">E-mail ...</label>
            </div>
            <div class="form-floating mb-3 mt-5">
                <input class="form-control" type="date" name="birthdate" id="birthdate" placeholder="Date of birth ...">
                <label for="birthdate">Date of birth ...</label>
            </div>
            <div class="form-floating mb-3 mt-5">
                <input class="form-control" type="password" name="password" id="password" placeholder="Password ...">
                <label for="password">Password ...</label>
            </div>
            <div class="form-floating mb-5">
                <input class="form-control" type="password" name="passwordCheck" id="passwordCheck" placeholder="Password(Again) ...">
                <label for="passwordCheck">Password(Again) ...</label>
            </div>
            <input class="btn btn-secondary mb-3 mt-5 fw-bold" type="submit" value="Register">
        </form>
    </div>

    <script src="../bootstrap-5.3.6-dist/js/bootstrap.bundle.min.js"></script>
    <script src="../scripts/js/theme.js"></script>
</body>
</html>
