## Contents / 目次

- [For what / 何のために](## For-what-/-何のために)

- [For example / 例](## For-example-/-例)

- [Ready and execute / 準備と実行](## Ready-and-execute-/-準備と実行)

  - [Edit config.json / config.jsonファイルの編集](### Edit-config.json-/-config.jsonファイルの編集)

  - [Change Apache port / Apacheのポート変更](### Change-Apache-port-/-Apacheのポート変更)

  - [Change Node.js port / Node.jsのポート変更](### Change-Node.js-port-/-Node.jsのポート変更)

  - [Run! / 実行！](### Run!-/-実行！)

- [How it works / どのような仕組みか](## How-it-works-/-どのような仕組みか)

- [Warning / 注意](## Warning-/-注意)



## For what / 何のために


Coexistence of Node.js, Apache and other HTTPS server softwares on the same server port(443).

Node.jsとApacheなどへのHTTPSリクエストを同じサーバのポートで受け付ける。共存させる。

例えば、Node.jsとApacheを同じサーバで動かしたいとき。
https://node.example.com でNode.jsへ、 https://apache.exapmle.com でApacheへアクセスできるようにしたい。

- HTTPSサーバならポート443をListenする。
- 同じポートを複数のソフトウェアがListenするのは不可能。後からサーバソフトウェアを起動した方が、「ポート443をListenできません」のようなエラーになるはず。
- https://apache.example.com:8443 のようにポートを明記すればアクセスできるが、格好悪い・不便である。

このような問題を解決する。


## For example / 例

Apache listen to 8443, Node.js listen to 8444, proxy-server.js listen to 443(default https port).

Apacheは8443ポートを、Node.jsは8444ポートを、proxy-server.jsは443ポートをListenする。

Users can access contents of *https://node.domain.com:8444* on Node.js by *https://node.domain.com* via proxy-server.js.

Apacheの*https://apache.domain.com:8443*で得られるコンテンツを、proxy-server.jsを通して*https://apache.domain.com*でアクセスできます。

Users can access contents of *https://apache.domain.com:8443* on Apache by *https://apache.domain.com* via proxy-server.js.

Node.jsの*https://node.domain.com:8444*で得られるコンテンツを、proxy-server.jsを通して*https://node.domain.com*でアクセスできます。


## Ready and execute / 準備と実行

準備から実行までは簡単です。
config.jsonファイルを編集、ApacheやNode.jsのListenポートを変更、そして実行するだけです。

### Edit config.json / config.jsonファイルの編集

まず、config.jsonファイルを、config.sample2.jsonなどを参考にしながら作成します。

- title: グループのタイトル 何でもよい / whatever
  - (ex. Apache Node.js Nginx SimpleHTTPServer)
- port: このグループは何番ポートをListenしているか
  - (ex. 8443 8444 8080 80)
  - (443はproxy-server.jsが使用するため、"server"を"localhost"にする場合は設定してはいけません。)
- server: このグループのサーバはどこにあるか
  - (ex. localhost 127.0.0.1 XX.XX.XX.XX)
- host: このグループに所属するホスト名（FQDN ドメイン名）と、そのSSL（TLS）証明書へのパス
    - hostname: ホスト名（FQDN ドメイン名）
      - (ex. node.example.com apache.example.com mydomain.com)
    - key: 秘密鍵ファイル / private key file
    - cert: 公開鍵ファイル / certification file

あとは、ApacheやNode.jsがListenするポートを変更すれば完了です。

### Change Apache port / Apacheのポート変更

Ubuntuの場合、/etc/apache2/ports.confに記述されています。
":443"と書かれた部分を":8443"などに変更するだけです。

### Change Node.js port / Node.jsのポート変更

以下のようにconfig.jsonに記述したListenするポート番号を記述してください。
`https.createServer(credential, () => {}).listen(8444)`

### Run! / 実行！

ビルドは必要ありません。

foreverがインストールされていない場合は、インストールをおすすめします。

実行にはsudoできる権限が必要です。これは、443ポートでListenしたり、サーバ証明書ファイルを開くために特権が必要だからです。

    git clone https://github.com/pxdog/nodejs-with-apache
    cd nodejs-with-apache

    # 便利な forever のインストール
    # foreverコマンドが使えるようになります
    sudo npm install forever -g
    
    # test / テスト リクエストされたホスト名・パスと、アクセスするクライアントのIP Addressを表示 
    # 以下の二つのコマンドは同じ
    # sudo node proxy-server.js test
    npm test

    # execute / 実行
    # 以下の二つのコマンドは同じ
    # sudo forever start proxy-server.js
    npm start

    # stop / 停止
    # 以下の二つのコマンドは同じ
    # sudo forever stop proxy-server.js
    npm stop


foreverをどうしても使いたくない場合は、nohupを使って以下のようにしても可。

    # execute / 実行
    # あらかじめsudoコマンドでパスワードを入力しておくこと！
    # sudo vi dummy.txt
    sudo nohup proxy-server.js > /dev/null  2>&1 &


## How it works / どのような仕組みか

複数のサーバソフトウェア（Node.jsやApache）が同じポートをListenすることはできない。
そこで、ポート443はProxyサーバ（のようなもの）proxy-server.jsがアクセスを受け付け、FQDN（ホスト名・ドメイン名）によってリクエストを振り分ける。


まず、*ポート443*でproxy-server.jsがアクセスを待つ。

Node.js(*node.example.com*)を*ポート8443*で受け付けられるようにし、Apache(*apache.example.com*)を*ポート8444*で受け付けるようにする。

*node.example.com*へのアクセスなら*ポート8443*へのリクエストを中継する。

*apache.example.com*へのアクセスなら*ポート8444*へのリクエストを中継する。

このように、*https://node.example.com:8443/*とアドレスバーに記述しなくても、*https://node.example.com/*と記述するだけでNode.jsサーバへアクセスすることができる。

## Warning / 注意

プロキシサーバのプロトコルを実装しているわけではありません。

サーバとブラウザの間にもう一つサーバを挟んでいるため、速度が遅くなると思います。

また、環境によっては動かない場合もあるかもしれませんが、責任は取れません。

