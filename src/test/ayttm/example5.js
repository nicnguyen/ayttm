require(['ayttm.min', 'knockout-3.0.0'], function(_, ko){

    var countries = [
        'Afghanistan',
        'Albania',
        'Algeria',
        'Andorra',
        'Angola',
        'Antigua and Barbuda',
        'Argentina',
        'Armenia',
        'Australia',
        'Austria',
        'Azerbaijan',
        'Bahamas, The',
        'Bahrain',
        'Bangladesh',
        'Barbados',
        'Belarus',
        'Belgium',
        'Belize',
        'Benin',
        'Bhutan',
        'Bolivia',
        'Bosnia and Herzegovina',
        'Botswana',
        'Brazil',
        'Brunei',
        'Bulgaria',
        'Burkina Faso',
        'Burma',
        'Burundi',
        'Cabo Verde',
        'Cambodia',
        'Cameroon',
        'Canada',
        'Central African Republic',
        'Chad',
        'Chile',
        'China',
        'Colombia',
        'Comoros',
        'Congo (Brazzaville)',
        'Congo (Kinshasa)',
        'Costa Rica',
        'Côte d\'Ivoire',
        'Croatia',
        'Cuba',
        'Cyprus',
        'Czech Republic',
        'Denmark',
        'Djibouti',
        'Dominica',
        'Dominican Republic',
        'Ecuador',
        'Egypt',
        'El Salvador',
        'Equatorial Guinea',
        'Eritrea',
        'Estonia',
        'Ethiopia',
        'Fiji',
        'Finland',
        'France',
        'Gabon',
        'Gambia, The',
        'Georgia',
        'Germany',
        'Ghana',
        'Greece',
        'Grenada',
        'Guatemala',
        'Guinea',
        'Guinea-Bissau',
        'Guyana',
        'Haiti',
        'Holy See',
        'Honduras',
        'Hungary',
        'Iceland',
        'India',
        'Indonesia',
        'Iran',
        'Iraq',
        'Ireland',
        'Israel',
        'Italy',
        'Jamaica',
        'Japan',
        'Jordan',
        'Kazakhstan',
        'Kenya',
        'Kiribati',
        'Korea, North',
        'Korea, South',
        'Kosovo',
        'Kuwait',
        'Kyrgyzstan',
        'Laos',
        'Latvia',
        'Lebanon',
        'Lesotho',
        'Liberia',
        'Libya',
        'Liechtenstein',
        'Lithuania',
        'Luxembourg',
        'Macedonia',
        'Madagascar',
        'Malawi',
        'Malaysia',
        'Maldives',
        'Mali',
        'Malta',
        'Marshall Islands',
        'Mauritania',
        'Mauritius',
        'Mexico',
        'Micronesia, Federated States of',
        'Moldova',
        'Monaco',
        'Mongolia',
        'Montenegro',
        'Morocco',
        'Mozambique',
        'Namibia',
        'Nauru',
        'Nepal',
        'Netherlands',
        'New Zealand',
        'Nicaragua',
        'Niger',
        'Nigeria',
        'Norway',
        'Oman',
        'Pakistan',
        'Palau',
        'Panama',
        'Papua New Guinea',
        'Paraguay',
        'Peru',
        'Philippines',
        'Poland',
        'Portugal',
        'Qatar',
        'Romania',
        'Russia',
        'Rwanda',
        'Saint Kitts and Nevis',
        'Saint Lucia',
        'Saint Vincent and the Grenadines',
        'Samoa',
        'San Marino',
        'Sao Tome and Principe',
        'Saudi Arabia',
        'Senegal',
        'Serbia',
        'Seychelles',
        'Sierra Leone',
        'Singapore',
        'Slovakia',
        'Slovenia',
        'Solomon Islands',
        'Somalia',
        'South Africa',
        'South Sudan',
        'Spain',
        'Sri Lanka',
        'Sudan',
        'Suriname',
        'Swaziland',
        'Sweden',
        'Switzerland',
        'Syria',
        'Tajikistan',
        'Tanzania',
        'Thailand',
        'Timor-Leste',
        'Togo',
        'Tonga',
        'Trinidad and Tobago',
        'Tunisia',
        'Turkey',
        'Turkmenistan',
        'Tuvalu',
        'Uganda',
        'Ukraine',
        'United Arab Emirates',
        'United Kingdom',
        'United States',
        'Uruguay',
        'Uzbekistan',
        'Vanuatu',
        'Venezuela',
        'Vietnam',
        'Yemen',
        'Zambia',
        'Zimbabwe'
    ];

    var filteredCountries = [];

    var SimpleListModel = function(items) {
        this.items = ko.observableArray(items);
        this.searchValue = ko.observable("");
        this.display = ko.computed(function () {
            var searchValue = this.searchValue();
            var l = this.items().filter(function(c){return c.toLowerCase() === searchValue.toLowerCase();});
            return l.length !== 1 && this.items().length != 0;
        }, this);
    };

    var model = new SimpleListModel(filteredCountries);
    ko.applyBindings(model);

    var updateFilteredCountryListModel = function(){
        var searchTerm = model.searchValue().toLowerCase();
        var filteredCountries = [];
        if (searchTerm.trim() !== "") {
            filteredCountries = countries.filter(function(c){
                return c.toLowerCase().indexOf(searchTerm) === 0;
            });
        }
        model.items(filteredCountries);
    };

    _('select').click().with(
        function(e) {
            var country = e.source.target.text;
            if (country) {
                model.searchValue(country);
                e.source.target.style.display = 'none';
                model.items([]);
            }
        }
    ).
    __();

    var uparrowkey = 38;
    var downarrowkey = 40;
    var enterkey = 13;

    var keyFilter = function(e) {return e.source.which != uparrowkey && e.source.which != downarrowkey && e.source.which !== enterkey;};

    _('#search').keydown().
        filter(keyFilter).
        with(_.timer(500)).
    until().
        _(_.timout()).with(updateFilteredCountryListModel).
    __();

    _('#search').keydown().with(
        function(e) {
            switch (e.source.which) {
                case uparrowkey : document.querySelector('select').selectedIndex--; break;
                case downarrowkey : document.querySelector('select').selectedIndex++; break;
                case enterkey :
                    var s = document.querySelector('select')
                    var country = s.options[s.selectedIndex].text;
                    model.searchValue(country);
                    s.style.display = 'none';
                    model.items([]);
            }
        }
    ).
    __();

    _('body').click().with(function(e){document.querySelector('select').style.display='none'; model.items([]);}).__();

});

