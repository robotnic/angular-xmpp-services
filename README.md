# angular-xmpp-services

This is a library talks to a xmpp server and generates a model, ready to use for directives. 


![structure](https://raw.githubusercontent.com/robotnic/angular-xmpp-services/master/src/assets/docimg/structure.png)

The library send and receives xmpp stanzas.
Based on this messages a model (json tree) is build.
The lib also handels the rendering timing by sinding promise notify messages.
https://docs.angularjs.org/api/ng/service/$q

* No $rootScope messaging needed
* ready to use automatic updating model
* easy to use API

#install

bower install angular-xmpp-services

#scripts
```
<script type="text/javascript" src="assets/scripts/primus.js"></script>
<script type="text/javascript" src="assets/angular-xmpp-services.js"></script>

```

#getting started

```

    var host="http://loas.buddycloud.com/";
    $scope.xmpp=new Xmpp(host);

    $scope.xmpp.watch().then(function(data){
        console.log("end - should never be reached");
    },function(error){
        console.log(error);
    },function(notification){
        console.log("notification",notification);
        //$scope.$apply() not needed,empty function fires render process
    });

    $scope.xmpp.anonymouslogin().then(function(){
        console.log("THE MODEL",$scope.xmpp.data.me);
    });

```

###me
$scope.xmpp.data.me
```
{
  "status": "online",
  "jid": {
    "local": "robotnic",
    "domain": "laos.buddycloud.com",
    "resource": "angular-xmpp",
    "user": "robotnic"
  }
}

```
### template
```
<div>user: {{xmpp.data.me.jid.user}}</div>
<div>domain: {{xmpp.data.me.jid.domain}}</div>
<div>{{xmpp.data.me.status}}"</div>
```

#directives

If you are looking for ready to use directive collection, this is the place to go: angular-xmpp

Here we learn how to make an directive





## getting started

```
<script type="text/javascript" src="../assets/scripts/primus.js"></script>
<!-- compiled CSS -->
<link rel="stylesheet" type="text/css" href="../assets/ngbp-0.3.2.css" />
<!-- compiled JavaScript -->
<script type="text/javascript" src="../assets/ngbp-0.3.2.js"></script>
```

## example xmpp chat
```

<xmpp host="https://laos.buddycloud.com">
    <xmpplogin></xmpplogin>
    <xmpproster></xmpproster>
    <xmppminichat></xmppminichat>
</xmpp>

```

## example xmpp muc
```

<xmpp host="https://laos.buddycloud.com">
    <xmpplogin></xmpplogin>
    <xmppmuc room="seehaus@channels.buddycloud.com"></xmppmuc>
</xmpp>

```

## example xmpp buddycloud
```

<xmpp host="https://laos.buddycloud.com">
    <xmpplogin></xmpplogin>
    <buddycloud room="/user/robotnic@laos.buddycloud.com/posts"></buddycloud>
</xmpp>

```



The templates include alle the javascript that has to be done and tries to keep the html simple.
Your part ist to give them a style.

## Angular binding exampe
```
<input ng-mode="node"/>
<buddycloud room="{{node}}" changenode="nodechangedinsidedirective(node)"></buddycloud>
```

In your controller
```
...
$scope.node="/user/robotnic@laos.buddycloud.com/posts";
$scope.nodechangedinsidedirective=function(node){
    //change hashtag or whatever
}

```




