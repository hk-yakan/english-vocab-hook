{ pkgs, ... }:

{
  languages.javascript = {
    enable = true;
    nodejs.enable = false;
    bun = {
      enable = true;
      install.enable = true;
    };
  };
  languages.typescript.enable = true;

  packages = [
    pkgs.lefthook
    pkgs.gitleaks
  ];

  enterShell = ''
    echo "english-vocab-hook dev environment ready"
    echo "bun $(bun --version)"
  '';
}
