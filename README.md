# angular-xmpp-services

This is a library talks to a xmpp server and generates a model { dynamic json }, ready to use for directives. 


![structure](https://raw.githubusercontent.com/robotnic/angular-xmpp-services/master/src/assets/docimg/structure.png)

The library send and receives xmpp stanzas.
Based on this messages a model (json tree) is build.
The lib also handels the rendering timing by sending promise notify messages.
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

Command list: <a href="https://xmpp-ftw.jit.su/manual/core/">xmpp-ftw-core</a>


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

    $scope.xmpp.send('xmpp.login',{
             "jid": "test1@laos.buddycloud.com",
             "password": "bbb"
    }).then(function(){
        $scope.xmpp.send("xmpp.roster.get")
        $scope.xmpp.send("xmpp.presence")
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

<a href="http://plnkr.co/edit/rolSSZnV7YzVg39aprAG?p=preview" target="_blank">plunker</a>


### template
```
<div>user: {{xmpp.data.me.jid.user}}</div>
<div>domain: {{xmpp.data.me.jid.domain}}</div>
<div>{{xmpp.data.me.status}}"</div>
```

<a href="http://plnkr.co/edit/tT45xZnb0lrBEo4AwsFJ?p=preview" target="_blank">plunker</a>


### roster with presence

```
 <div ng-repeat="item in xmpp.data.roster">
    <div ng-if="item.presence" class="status online"></div>
    <div ng-if="!item.presence" class="status offline"></div>
    {{item.jid.user}}@{{item.jid.domain}}
    <p class="statustext">{{item.presence.status}}</p>
  </div>
```

<a href="http://plnkr.co/edit/YU4cbe3UpG3KrR2Xot4X?p=preview" target="_blank">plunker</a>

### send messages

<a href="http://plnkr.co/edit/woHSouYiMziZzKrq5lrL?p=preview" target="_blank">plunker</a>



#directives

If you are looking for ready to use directive collection, this is the place to go: [angular-xmpp](https://github.com/robotnic/angular-xmpp)

Here we learn how to make an directive



## structure

There is an outer &lt;xmpp>&lt;/xmpp> that containes the other directives. It provides xmpp core https://xmpp-ftw.jit.su/manual/core/


```

<xmpp xmpp-ftw-host="https://laos.buddycloud.com" domain="laos.buddycloud.com">
    <xmpplogin></xmpplogin>
    <xmpproster></xmpproster>
    <xmppminichat></xmppminichat>
    <xmppmycoolapp></xmppmycoolapp>
</xmpp>

```

## build directives

```
.directive('roster', function() {
    return {
        'require': '^xmpp',
        'restrict': 'E',
        'scope': {
            oninit:'&oninit'
        },
        'transclude': false,
        'templateUrl': 'roster/template.tpl.html',
        'link': function(scope, element, attrs,xmppController) {
            scope.xmpp=xmppController.xmpp;  //this commes from <xmpp></xmpp>
            xmppController.on("connected",function(event,status){
                scope.xmpp.send("xmpp.roster.get");
            });
        }
    };
})
```

##model  { dynamic json }
```
[
  {
    "jid": {
      "domain": "denisw.buddycloud.com",
      "user": "simon"
    },
    "subscription": "none",
    "name": "simon"
  },
  {
    "jid": {
      "domain": "laos.buddycloud.com",
      "user": "seppl"
    },
    "subscription": "both",
    "name": "seppl"
  },
  {
    "jid": {
      "domain": "laos.buddycloud.com",
      "user": "eva"
    }
]

```
##template
roster/template.tpl.html

```

    <div ng-repeat="item in page.xmpp.data.roster" class="rosteritem">
        <div ng-show="item.presence || item.subscription"  class="indicator {{item.presence.show}}" ng-class="{'ask':item.subscription=='from','noauth':item.subscription=='to','none':item.subscription=='none'}"></div>
        <div ng-show="!item.presence && !item.subscription"  class="indicator offline"></div>
        {{item.jid.user}}
        <div class="status">
        {{item.presence.status}}
        </div>
    </div>

```


